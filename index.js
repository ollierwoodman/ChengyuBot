const Discord = require('discord.js');
const client = new Discord.Client();

var fs = require('fs');

const PERSISTENT_DAILY_CHENGYU_INDEX_FILEPATH = './index.txt';
const FALLBACK_DAILY_CHENGYU_INDEX = 0;
const ONLINE_DICT_LINK_FORMAT = "https://baike.baidu.com/item/{chengyu}";

//GLOBAL VARS
const _config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const _chengyuDict = JSON.parse(fs.readFileSync(_config.chengyuDictFilePath, 'utf8'));
var _currentDailyChengyuIndex = -1;

client.login(_config.loginToken);

//executes once client is logged in
client.once('ready', () => {
	console.log(`Ready! Logged in as ${client.user.tag}`);

	initDailyChengyuIndexValue();

	const millisecondsInADay = 86400000;
	const timeNow = new Date();
	var timeToNewDailyChengyu = new Date(timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), _config.hourToSendDailyChengyuMessageUTC, 0, 0, 0) - timeNow;
	if (timeToNewDailyChengyu < 0) {
		timeToNewDailyChengyu += millisecondsInADay; // it's after 10am, try 10am tomorrow.
	}
	const timeout = setTimeout(function() { startDailyChengyuLoop(); }, timeToNewDailyChengyu);
});

//starts the daily chengyu loop
function startDailyChengyuLoop() {
	const millisecondsInADay = 86400000;
	const interval = setInterval(function() { newDailyChengyu(); }, millisecondsInADay);
}

function initDailyChengyuIndexValue() {
	if (fs.existsSync(PERSISTENT_DAILY_CHENGYU_INDEX_FILEPATH)) {
		_currentDailyChengyuIndex = fs.readFileSync(PERSISTENT_DAILY_CHENGYU_INDEX_FILEPATH, 'utf8');
	}
	
	if (_currentDailyChengyuIndex < 0) {
		_currentDailyChengyuIndex = FALLBACK_DAILY_CHENGYU_INDEX;
	}
	
	if (_currentDailyChengyuIndex >= _chengyuDict.entries.length) {
		_currentDailyChengyuIndex = FALLBACK_DAILY_CHENGYU_INDEX;
	}
}

//main function that gets looped each interval
function newDailyChengyu() {
	const newDailyChengyuIndex = getRandomChengyuIndex(_chengyuDict);
	sendDailyChengyuMessage(buildChengyuEmbed(newDailyChengyuIndex));
	_currentDailyChengyuIndex = newDailyChengyuIndex;
}

function getRandomChengyuIndex(chengyuEntries) {
	return Math.floor(Math.random() * (chengyuEntries.entries.length - 1));
}

//sends the daily chengyu embed to the designated channel
function sendDailyChengyuMessage(embed) {
	var messageText;
	var consoleMessage;	

	if ('chengyuRoleId' in _config) {
		//send embed with role ping
		messageText = '<@&' + _config.dailyChengyuPingRoleId + '> 今天的成语来啦';
		consoleMessage = 'Chengyu sent to channel with role ping';
	}
	else {
		//send embed without role ping
		messageText = '今天的成语来啦';
		consoleMessage = 'Chengyu sent to channel without role ping';
	}

	client.channels.cache.get(_config.dailyChengyuMessageChannelId).send(messageText, { embed: embed })
		.then(logInConsoleWithTime(consoleMessage))
		.catch(console.error);
}

function buildChengyuEmbed(chengyuIndex) {
	const currentChengyu = _chengyuDict.entries[chengyuIndex]

	let chengyuEmbed = new Discord.MessageEmbed()
		.setTitle(`${currentChengyu["phrase"]["zhCN"]}（${currentChengyu["phrase"]["zhHK"]}）`)
		.setURL(ONLINE_DICT_LINK_FORMAT.replace('{chengyu}', currentChengyu["phrase"]["zhCN"]))
		.setDescription(`${currentChengyu["phrase"]["zhPY"]}\n${currentChengyu["translations"]["enGB"]}`)
		.setFooter(`Source: ${_chengyuDict['citation']['apa']} ${_chengyuDict['citation']['link']}`)
		.setTimestamp(new Date());

	const examples = currentChengyu['examples'];
	for (let i = 0; i < examples.length; i++) {
		chengyuEmbed.addField(`例句 ${i+1}`, `${examples[i]['zhCN']}\n${examples[i]['enGB']}`);
	}
	
	if ('primaryColour' in _config) {
		chengyuEmbed.setColor(_config.primaryColour)
	} else {
		chengyuEmbed.setColor(0xfd9854)
	}
	
	if ('chengyuEmoji' in _config) {
		chengyuEmbed.setThumbnail('https://cdn.discordapp.com/emojis/' + _config.chengyuEmoji.id + '.png')
	}

	return chengyuEmbed;
}

function findIndexOfChengyu(searchTerm, chengyuDict) {		
	var found = -1;
	for (let i = 0; i < chengyuDict['entries'].length; i++) {
		const entry = chengyuDict['entries'][i];

		if (searchTerm == entry['phrase']['zhCN'] || searchTerm == entry['phrase']['zhHK']) {
			found = i;
			break;
		}
	}
	return found
}

function logInConsoleWithTime(string, error=false) {
	const out = `${new Date().toISOString()} - ${string}`;
	if (error) {
		console.error(out);
	} else {
		console.log(out);
	}
}

client.on('message', message => {
	//searching for a chengyu
	if (message.content.slice(0, 3) === '!cy' || message.content.slice(0, 3) === '！cy') {
		const searchTerm = message.content.slice(4).trim();		
		const index = findIndexOfChengyu(searchTerm, _chengyuDict);
		if (index != -1) {
			message.channel.send("Here's that 成语 you were looking for...", { embed: buildChengyuEmbed(index) })
			.then(logInConsoleWithTime(`${message.author.username} searched for ${searchTerm} and I found it!`))
			.catch(console.error);
		} else {
			message.channel.send(`I couldn't find ${searchTerm} in my records, sorry :(`)
			.then(logInConsoleWithTime(`${message.author.username} searched for ${searchTerm} but I couldn't find it :(`))
			.catch(console.error);
		}
	}
	//if someone sends a message that contains the daily chengyu
	else if (
		message.content.includes(_chengyuDict['entries'][_currentDailyChengyuIndex]['phrase']['zhCN'])
		|| message.content.includes(_chengyuDict['entries'][_currentDailyChengyuIndex]['phrase']['zhHK'])
	) {
		message.react(message.guild.emojis.cache.get(_config.chengyuEmoji.key))
			.then(logInConsoleWithTime(message.author.username + ' used the daily chengyu'))
			.catch(console.error);
	}
});

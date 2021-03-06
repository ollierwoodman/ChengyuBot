const Discord = require('discord.js');
const client = new Discord.Client();

const cheerio = require('cheerio');
const got = require('got');
var fs = require('fs');

//GLOBAL VARS
const _configFile = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
var _chengyuDict = {
	hanzi: "err",
	pinyin: "err",
	english: "err",
	url: "err"
};
var _dailyChengyuEmbed; //global variable for the message embed to be stored

client.login(_configFile.loginToken);

//executes once client is logged in
client.once('ready', () => {

	getDailyChengyuURL();
	//run main every certain number of minutes
	const interval = setInterval(function() { main(); }, _configFile.minutesBetweenScrapes * 60 * 1000);

});

//main function that gets looped each interval
function main() {
	
	var chengyuFile = returnJSONObjectFromJSONFile('./chengyu.json');
	if (chengyuFile === null) {
		chengyuFile = {hanzi:"err"};
	}

	if (chengyuFile.hanzi !== _chengyuDict.hanzi) {
		sendDailyChengyuMessage();
		overwriteChengyuFile(_chengyuDict.hanzi, _chengyuDict.pinyin, _chengyuDict.english, _chengyuDict.url)
	}
	else {
		logInConsoleWithTime('Chengyu not new, no update.');
	}
	//get the daily chengyu for the next loop to check
	getDailyChengyuURL();
}

function returnJSONObjectFromJSONFile(path) {
	var strFileContent = fs.readFileSync(path, 'utf8');
	if (isValidJSONString(strFileContent)) {
		return JSON.parse(strFileContent);
	} else {
		return null;
	}
}

function isValidJSONString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

function overwriteChengyuFile(hanzi, pinyin, english, url) {
	//create object to write to the json file
	var chengyuObj = {
		"hanzi":hanzi, 
		"pinyin":pinyin, 
		"english":english,
		"url":url
	};

	jsonString = JSON.stringify(chengyuObj); //convert object to a string in the json format 

	//write json string to file
	fs.writeFile ("./chengyu.json", JSON.stringify(chengyuObj), function(err) {
		if (err) throw err;
		logInConsoleWithTime('Chengyu file overwritten');
		}
	);
}

//function to load the daily chengyu link
//the data on this webpage changes about every 24 hours
function getDailyChengyuURL() {
	got(_configFile.chineseToolsDailyChengyuUrl).then(response => {

		const $ = cheerio.load(response.body);

		//scraping basic data from the daily chengyu page and saving it 
		_chengyuDict.hanzi = $('div[class=ctCyRCn]').text();
		_chengyuDict.pinyin = $('div[class=ctCyRPinyin]').text();
		_chengyuDict.english = $('div[class=ctCyRDef]').text();
		_chengyuDict.url = $('a[class=ctCyRMoreA]').attr('href');

		logInConsoleWithTime('Daily chengyu scraped.');
		
		createDailyChengyuEmbed(_chengyuDict.url); //used the scraped url for the chengyu's full dictionary entry to create the embed

	}).catch(err => {0-
		logInConsoleWithTime('Scraping failed.');
	});
}

//get the chengyu's dictionary entry and create an embed with the details scraped from it
function createDailyChengyuEmbed(url) {

	got(url).then(response => {

		const $ = cheerio.load(response.body);

		_dailyChengyuEmbed = new Discord.MessageEmbed()
			.setColor('fd9854')
			.setTitle('???????????????' + _chengyuDict.hanzi)
			.setURL(url)
			.setDescription(_chengyuDict.pinyin + '\n' + _chengyuDict.english)
			.setThumbnail('https://cdn.discordapp.com/emojis/730341301534326784.png')
			.setTimestamp(new Date());

		const details = $('div .ctCyC4').children();

		for (let i = 0; i < details.length / 2; i++) {
			_dailyChengyuEmbed.addField(details.eq(i * 2).text(), details.eq(i * 2 + 1).text());
		}

		logInConsoleWithTime('Channel embed created with extra details.');

	//if the dictionary entry scrape fails, create a basic chengyu message
	}).catch(err => {

		_dailyChengyuEmbed = {
			color: 0xfd9854,
			title: _chengyuDict.hanzi,
			thumbnail: {
				url: 'https://cdn.discordapp.com/emojis/730341301534326784.png',
			},
			description: (_chengyuDict.pinyin + '\n' + _chengyuDict.english),
			url: chengyuUrl,
			timestamp: new Date(),
		};

		logInConsoleWithTime('Channel embed created without extra details.');
	});
}

//sends the daily chengyu embed to the designated channel
function sendDailyChengyuMessage() {
	//if a pingable chengyu role is included in the config file
	if (_configFile.chengyuRoleId) {
		//send embed with role ping
		client.channels.cache.get(_configFile.channelId).send('<@&' + _configFile.chengyuRoleId + '> ?????????????????????', { embed: _dailyChengyuEmbed })
		.then(logInConsoleWithTime('Chengyu sent to channel with role ping'))
		.catch(console.error);
	}
	else {
		//send embed without role ping
		client.channels.cache.get(_configFile.channelId).send('?????????????????????', { embed: _dailyChengyuEmbed })
		.then(logInConsoleWithTime('Chengyu sent to channel without role ping'))
		.catch(console.error);
	}
}

function createSearchChengyuMessage(searchphrase) {
	const chengyuUrl = 'https://www.chinese-tools.com/chinese/chengyu/dictionary/detail.html?q=' + searchphrase;

	got(chengyuUrl).then(response => {

		const $ = cheerio.load(response.body);

		let chengyuEmbed = new Discord.MessageEmbed()
			.setColor('fd9854')
			.setTitle($('div .ctCyC1').text())
			.setURL(chengyuUrl)
			.setDescription($('div .ctCyC2').eq(0).text() + '\n' + $('div .ctCyC2').eq(1).text())
			.setThumbnail('https://cdn.discordapp.com/emojis/730341301534326784.png')
			.setTimestamp(new Date());

		const details = $('div .ctCyC4').children();

		let i;
		for (i = 0; i < details.length / 2; i++) {
			chengyuEmbed.addField(details.eq(i * 2).text(), details.eq(i * 2 + 1).text());
		}

		logInConsoleWithTime('Chengyu search successful');

		return chengyuEmbed;

	}).catch(err => {

		let chengyuEmbed = {
			color: 0xfd9854,
			title: 'Error ',
			thumbnail: {
				url: 'https://cdn.discordapp.com/emojis/728711704644419730.png',
			},
			description: ('I could not find any chengyu called "' + message.content.slice(4) + '"\n' + '???????????????????????????????????????\n\nMaybe you can find it on Baidu (??????)\n???????????????????????????\n\n[Click here to search Baidu!](https://baike.baidu.com/search?word=' + message.content.slice(4) + '&pn=0&rn=0&enc=utf8)'),
		};
		logInConsoleWithTime('Chengyu search failed');

		return chengyuEmbed;
	});
}

function logInConsoleWithTime(string) {
	const timeNow = new Date();
	console.log(`${timeNow.getHours()}:${timeNow.getMinutes()};${timeNow.getSeconds()} ` + string);
}

client.on('message', message => {
	if (message.content.slice(0, 3) === '!cy' || message.content.slice(0, 3) === '???cy') {

		message.channel.send({ embed: createSearchChengyuMessage(message.content.slice(4)) })
			.then(logInConsoleWithTime(message.author.username + ' searched for a chengyu'))
			.catch(console.error);

	}
	else if (message.content.includes(_chengyuDict.hanzi)) {
		message.react(message.guild.emojis.cache.get(_configFile.orangeEmojiId))
			.then(logInConsoleWithTime(message.author.username + ' used the daily chengyu'))
			.catch(console.error);
	}
});

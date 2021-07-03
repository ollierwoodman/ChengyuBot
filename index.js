const Discord = require('discord.js');
const client = new Discord.Client();

const cheerio = require('cheerio');
const got = require('got');
var fs = require('fs');

//GLOBAL VARS
const _configFile = require('./config.json');
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

//main resresh loop
function main() {
	var chengyuFile = JSON.parse(fs.readFileSync('./chengyu.json', 'utf8')); //check the chengyu file every loop to see if the current scraped chengyu is different
	if (chengyuFile.hanzi !== _chengyuDict.hanzi) {
		//if the saved chengyu is different from the current, overwrite the chengyu file and send the new chengyu message to the daily chengyu channel 
		overwriteChengyuFile(_chengyuDict.hanzi, _chengyuDict.pinyin, _chengyuDict.english, _chengyuDict.url)
		sendChannelMessage();
	}
	else {
		console.log('Chengyu not new, no update.');
	}
	//get the daily chengyu for the next loop to check
	getDailyChengyuURL();
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
	var fs = require('fs');
	fs.writeFile ("./chengyu.json", JSON.stringify(chengyuObj), function(err) {
		if (err) throw err;
		console.log('Chengyu file overwritten');
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

		console.log('Daily chengyu scraped.');
		
		createDailyChengyuEmbed(_chengyuDict.url); //used the scraped url for the chengyu's full dictionary entry to create the embed

	}).catch(err => {0-
		console.log('Scraping failed.');
	});
}

//get the chengyu's dictionary entry and create an embed with the details scraped from it
function createDailyChengyuEmbed(url) {

	got(url).then(response => {

		const $ = cheerio.load(response.body);

		_dailyChengyuEmbed = new Discord.MessageEmbed()
			.setColor('fd9854')
			.setTitle('今日成语：' + _chengyuDict.hanzi)
			.setURL(url)
			.setDescription(_chengyuDict.pinyin + '\n' + _chengyuDict.english)
			.setThumbnail('https://cdn.discordapp.com/emojis/730341301534326784.png')
			.setTimestamp(new Date());

		const details = $('div .ctCyC4').children();

		for (let i = 0; i < details.length / 2; i++) {
			_dailyChengyuEmbed.addField(details.eq(i * 2).text(), details.eq(i * 2 + 1).text());
		}

		console.log('Channel embed created with extra details.');

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

		console.log('Channel embed created without extra details.');
	});
}

//sends the daily chengyu embed to the designated channel
function sendChannelMessage() {
	//if a pingable chengyu role is included in the config file
	if (_configFile.chengyuRoleId) {
		//send embed with role ping
		client.channels.cache.get(_configFile.channelId).send('<@&' + _configFile.chengyuRoleId + '> 今天的成语来啦', { embed: _dailyChengyuEmbed })
		.then(console.log('Chengyu sent to channel with role ping'))
		.catch(err);
	}
	else {
		//send embed without role ping
		client.channels.cache.get(_configFile.channelId).send('今天的成语来啦', { embed: _dailyChengyuEmbed })
		.then(console.log('Chengyu sent to channel without role ping'))
		.catch(err);
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

		console.log('Chengyu search successful');

		return chengyuEmbed;

	}).catch(err => {

		let chengyuEmbed = {
			color: 0xfd9854,
			title: 'Error ',
			thumbnail: {
				url: 'https://cdn.discordapp.com/emojis/728711704644419730.png',
			},
			description: ('I could not find any chengyu called "' + message.content.slice(4) + '"\n' + '尴尬了，我没能搜到这个成语\n\nMaybe you can find it on Baidu (百度)\n百度一下，你就知道\n\n[Click here to search Baidu!](https://baike.baidu.com/search?word=' + message.content.slice(4) + '&pn=0&rn=0&enc=utf8)'),
		};
		console.log('Chengyu search failed');

		return chengyuEmbed;
	});
}

client.on('message', message => {
	if (message.content.slice(0, 3) === '!cy' || message.content.slice(0, 3) === '！cy') {

		message.channel.send({ embed: createSearchChengyuMessage(message.content.slice(4)) })
			.then(console.log(message.author.username + ' searched for a chengyu'))
			.catch(console.error);

	}
	else if (message.content.includes(_chengyuDict.hanzi)) {
		message.react(message.guild.emojis.cache.get(_configFile.orangeEmojiId))
			.then(console.log(message.author.username + ' used the daily chengyu'))
			.catch(console.error);
	}
});

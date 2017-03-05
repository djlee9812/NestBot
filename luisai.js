var builder = require('botbuilder');
var restify = require('restify');

/*
// Create bot and bind to console
var connector = new builder.ConsoleConnector().listen();
var bot = new builder.UniversalBot(connector);
*/
// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
	console.log('%s listening to %s', server.name, server.url); 
});

var connector = new builder.ChatConnector({
	appId: process.env.APPID,
	appPassword: process.env.APPPW
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
server.get('/', restify.serveStatic({
	directory: __dirname,
	default: '/index.html'
}));

var model = process.env.MODEL;
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });

bot.dialog('/', dialog);

dialog.matches('getTemp', function(session) {
	session.send("The current temperature is ");
});

dialog.matches('setTemp', [
	function(session, args, next) {
		var temp = builder.EntityRecognizer.findEntity(args.entities, 'temperature');
		var eco = builder.EntityRecognizer.findEntity(args.entities, 'eco');
		var thermData = session.dialogData.thermData = {
			temp: temp ? temp.entity : null,
			eco: eco ? eco.entity : null,
		}
		if(!temp) {
			builder.Prompts.number(session, "What temperature would you like your thermostat to be at?");
		} else if(!eco) {
			builder.Prompts.choice(session, "Would you like eco mode?", "Yes|No");
		} else {
			next();
		}
	},
	function(session, results, next) {
		var thermData = session.dialogData.thermData;
		if(results.response) {
			if(!thermData.temp) {
				thermData.temp = results.response;
				//account for if not anumber
				if(!thermData.eco) {
					builder.Prompts.choice(session, "Would you like eco mode?", "Yes|No");
				} else {
					next();
				}
			} else {
				thermData.eco = results.response;
				next();
			}
		}
	},
	function(session, results) {
		var thermData = session.dialogData.thermData;
		if(results.response) {
			thermData.eco = results.response;
		}
	}
]);

dialog.matches('setMode', [
	function(session, args, next) {
		var mode = builder.EntityRecognizer.findEntity(args.entities, 'Location');
		if(!mode) {
			builder.Prompts.choice(session, "Which mode?", "home|away");
		} else {
			next();
		}
	},
	function(session, results) {
		if(results.response) {
			session.send('ok!');
		}
	}
	]);

dialog.matches('None', function(session) {
	session.send("Sorry, I didn't understand \'%s\'. Try again.", session.message.text);
});


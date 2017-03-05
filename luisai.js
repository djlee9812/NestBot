var builder = require('botbuilder');
var restify = require('restify');
var fetch = require('node-fetch');
var express = require('express')
var favicon = require('serve-favicon');
var path = require('path');

var app = express()
app.use(favicon(path.join(__dirname, 'favicon.ico')));

/*
// Create bot and bind to console
var connector = new builder.ConsoleConnector().listen();
var bot = new builder.UniversalBot(connector);
*/
// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3977, function () {
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
	session.sendTyping();
	fetch('https://developer-api.nest.com', {
		method: 'GET',
		headers: {
			Authorization: process.env.NESTAUTH,
			'Content-Type': 'application/json'
		}
	}).then(response => {
		return response.json();
	}).then(result => {
		var temp = (result.devices.thermostats['process.env.NESTKEY'].ambient_temperature_f);
		session.send("Your current home temperature is " + temp + " degrees.");
	})

});

dialog.matches('setTemp', [
	function(session, args, next) {
		session.sendTyping();
		session.dialogData.temp = builder.EntityRecognizer.findEntity(args.entities, 'temp');
		if(!session.dialogData.fdtemp) {
			builder.Prompts.number(session, "What temperature would you like your thermostat to be set on?");
		} else {
			next();
		}
	},
	function(session, results, next) {
		session.sendTyping();
		if(results.response) {
			session.dialogData.temp = results.response;
			//account for if not anumber
		}
		var ambTemp;
		fetch('https://developer-api.nest.com', {
			method: 'GET',
			headers: {
				Authorization: process.env.NESTAUTH,
				'Content-Type': 'application/json'
			}
		}).then(response => {
			return response.json();
		}).then(result => {
			ambTemp = (result.devices.thermostats['process.env.NESTKEY'].ambient_temperature_f);
			if(ambTemp > session.dialogData.temp){
				fetch('https://developer-api.nest.com/devices/thermostats/' + process.env.NESTKEY + '/', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': process.env.NESTAUTH,
					},
					body: JSON.stringify({ 
						'hvac_mode': "cool",
					})
				}).then(response => {
					return response.json();
				}).then(result => {
					console.log(result);
				}).catch(function(error) {
					if(error) {
						console.log(error.message);
					}
				});
				session.send("A/C turned on.");

				setTimeout(function() {
					fetch('https://developer-api.nest.com/devices/thermostats/' + process.env.NESTKEY + '/', {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': process.env.NESTAUTH,
						},
						body: JSON.stringify({ 
							'target_temperature_f': session.dialogData.temp,
						})
					});
				}, 3000);
			} else {
				fetch('https://developer-api.nest.com/devices/thermostats/' + process.env.NESTKEY + '/', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: process.env.NESTAUTH,
					},
					body: JSON.stringify({
						"hvac_mode": "heat"
					})
				});
				session.send("Heater turned on.");

				setTimeout(function() {
					fetch('https://developer-api.nest.com/devices/thermostats/' + process.env.NESTKEY + '/', {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							Authorization: process.env.NESTAUTH,
						},
						body: JSON.stringify({
							"target_temperature_f": session.dialogData.temp,
						})
					});
				}, 3000);
			}
		});
	}

	]);

dialog.matches('setMode', [
	function(session, args, next) {
		session.sendTyping();
		session.dialogData.mode = builder.EntityRecognizer.findEntity(args.entities, 'Location');
		if(!session.dialogData.mode) {
			builder.Prompts.choice(session, "Which mode?", "home|away");
		} else {
			next();
		}
	},
	function(session, results) {
		session.sendTyping();
		if(results.response) {
			session.dialogData.mode = results.response;
		}
		fetch('https://developer-api.nest.com/structures/TC4djjBxjk4jN8vLgP2Ssajc83fi_kRmym3NNHBZJEHQr1p1cEjj9A', {
			method: 'PUT',
			headers: {
				Authorization: process.env.NESTAUTH,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"away": session.dialogData.mode.entity
			})
		});
		session.send("Mode set to " + session.dialogData.mode.entity);
	}
	]);
dialog.matches('rude', function(session, args) {
	session.sendTyping();
	var num = Math.random();
	if(num < .33) {
		session.send("Please don't be rude.");
	} else if(num < .66) {
		session.send("Cyber-bullying is a not a victimless crime.");
	} else {
		session.send("I'm gonna report you.");
	}
});

dialog.matches('getTime', function(session, args) {
	session.sendTyping();
	fetch('https://developer-api.nest.com', {
		method: 'GET',
		headers: {
			Authorization: process.env.NESTAUTH,
			'Content-Type': 'application/json'
		}
	}).then(response => {
		return response.json();
	}).then(result => {
		var time = result.devices.thermostats[process.env.NESTAUTH].time_to_target;
		session.send(time + " minutes until target temperature.");
	}).catch(function(error) {
		if(error) {
			console.log(error.message);
		}
	});
});

dialog.matches('turnOff', function(session, args) {
	fetch('https://developer-api.nest.com/devices/thermostats/' + process.env.NESTKEY + '/', {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: process.env.NESTAUTH,
		},
		body: JSON.stringify({
			"hvac_mode": "off"
		})
	});
	session.send("HVAC Climate control turned off.");
})

dialog.matches('greeting', function(session, args) {
	session.sendTyping();
	session.send("Hi, how may I help you today?");
});
dialog.matches('None', function(session) {
	session.sendTyping();
	session.send("Sorry, I didn't understand \'%s\'. Try again.", session.message.text);
});

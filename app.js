var discord = require('discord.js');
var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var config = require('./config.js');

var botID = 0;

var bot = new discord.Client();
winston.add(winston.transports.File, { filename: 'bot.log' });

bot.on('ready', function(){
  botID = bot.user.id;
  _.each(bot.users, function(user){
    // exclude the bot
    if (user.id !== botID) {
      request('http://evewho.com/api.php?type=character&name=' + user.username, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var json = JSON.parse(body);
          var message = '';
          if (json.info === null) {
            message = 'ERROR: ' + user.username + ' is not a real eve character name';
            bot.sendMessage('110597550708375552', message);
            winston.info(user.username + ' not valid');
          }
        }
      });
    }
  });
});


bot.login(config.email, config.password);

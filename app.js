var mysql = require('mysql');
var discord = require('discord.js');
var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var config = require('./config.js');

var botID = 0;
var message = '';
var excludeUserID = config.excludeUserID;
var adminChannelID = config.adminChannelID;

var con = mysql.createConnection({
  host : config.mysqlHost,
  user : config.mysqlUsername,
  password : config.mysqlPassword,
  database : config.mysqlDatabase
});
con.connect(function(err) {
  if (err) { winston.error(err); return; }
  winston.info('mysql connection established');
});
var bot = new discord.Client();
winston.add(winston.transports.File, { filename: 'bot.log' });

/**
 * DISCORD EVENTS
 */

bot.on('ready', function() {
  botID = bot.user.id;
  _.each(bot.users, function(user) {
    checkUsername(user);
  });
});

bot.on('presence', function(user, status, gameID) {
  if (status === 'online') {
    checkUsername(user);
  }
});

bot.on('serverNewMember', function(server, user) {
  message = 'New User: ' + user.username + ' joined Discord';
  bot.sendMessage(adminChannelID, message);
  checkUsername(user);
});

bot.on('serverMemberRemoved', function(server, user) {
  message = 'User Deleted: ' + user.username + ' was removed from Discord';
  bot.sendMessage(adminChannelID, message);
});

bot.on('userBanned', function(server, user) {
  message = 'User Banned: ' + user.username + ' was banned from Discord';
  bot.sendMessage(adminChannelID, message);
});

bot.on('userUnbanned', function(server, user) {
  message = 'User Unbanned: ' + user.username + ' was unbanned from Discord';
  bot.sendMessage(adminChannelID, message);
});

bot.on('error', function(error) {
  winston.error(error);
});

bot.login(config.email, config.password);

/**
 * FUNCTIONS
 */

/**
 * [checkUsername checks if they have the same Discord name as their primary EVE character on Auth]
 * @param  {[object]} user
 * @return {[none]}
 */
function checkUsername(user) {
  // exclude self
  if (user.id === botID) {
    return;
  }
  // exclude another bot
  if (user.id === excludeUserID) {
    return;
  }
  con.query('SELECT eveonline_evecharacter.character_name FROM eveonline_evecharacter INNER JOIN authentication_authservicesinfo ON eveonline_evecharacter.character_id = authentication_authservicesinfo.main_char_id WHERE authentication_authservicesinfo.discord_uid = ?', [user.id], function(err, res){
    if (err) winston.error(err);
    var message = '';
    if (res.length > 0) {
      if (user.username !== res[0].character_name) {
        message = 'WARNING: ' + user.username + ' needs to change their Discord name to ' + res[0].character_name;
        bot.sendMessage(user, message);
        bot.sendMessage(adminChannelID, message);
        winston.warn(message);
      }
      // testing
      /*else {
        message = user.username + ' matches ' + res[0].character_name;
        winston.info(message);
      }*/
    }
    else {
      message = 'WARNING: ' + user.username + ' is not on auth';
      bot.sendMessage(adminChannelID, message);
      winston.warn(message);
    }
  });
}








/*request('http://evewho.com/api.php?type=character&name=' + user.username, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var json = JSON.parse(body);
    var message = '';
    if (json.info === null) {
      message = 'ERROR: ' + user.username + ' is not a real eve character name';
      bot.sendMessage(adminChannelID, message);
      winston.info(user.username + ' not valid');
    }
  }
});*/

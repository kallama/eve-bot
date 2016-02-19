var mysql = require('mysql');
var mysqlEvents = require('mysql-events');
var discord = require('discord.js');
var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var moment = require('moment');
var config = require('./config.js');

var botID = 0;
var message = '';
var excludeUserID = config.excludeUserID;
var announceChannelID = config.announceChannelID;
var adminChannelID = config.adminChannelID;

winston.add(winston.transports.File, { filename: 'bot.log' });
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
var dsn = {
  host: config.mysqlHost,
  user: config.mysqlUsername,
  password: config.mysqlPassword
};
var conEvents = mysqlEvents(dsn);
var bot = new discord.Client();


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
 * MYSQL EVENTS
 */

 var fleetTimers = conEvents.add(
   config.mysqlDatabase + '.optimer_optimer',
   function (oldRow, newRow) {
     var message = '';
     // insert
     if (oldRow === null) {
       con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
         if (err) winston.error(err);
         if (res.length > 0) {
           var eveTime = moment(newRow.fields.start).format('YYYY-MM-DD HH:mm:ss');
           message = '**Fleet Timer Added** - ' + newRow.fields.operation_name + ': ' +
           ' - Doctrine: **' + newRow.fields.doctrine + '**' +
           ' - System: **' + newRow.fields.system + '**' +
           ' - Location: **' + newRow.fields.location + '**' +
           ' - Start Time: **' + eveTime + '**' +
           ' - Duration: **' + newRow.fields.duration + '**' +
           ' - Fleet Commander **: ' + newRow.fields.fc + '**' +
           ' - Extra Details : **' + newRow.fields.details + '**' +
           ' - Created By: *' + res[0].character_name + '*';
           bot.sendMessage(announceChannelID, message);
           winston.info('new fleet timer announced on Discord');
         }
       });
     }
     // update
     else if (newRow !== null && oldRow !== null) {
       // todo
     }
     // delete
     else if (newRow === null) {
       con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
         if (err) winston.error(err);
         if (res.length > 0) {
           var eveTime = moment(oldRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
           message = '**Fleet Timer Deleted** - ~~' + oldRow.fields.operation_name + ': ' +
           ' - Doctrine: **' + oldRow.fields.doctrine + '**' +
           ' - System: **' + oldRow.fields.system + '**' +
           ' - Location: **' + oldRow.fields.location + '**' +
           ' - Start Time: **' + eveTime + '**' +
           ' - Duration: **' + oldRow.fields.duration + '**' +
           ' - Fleet Commander **: ' + oldRow.fields.fc + '**' +
           ' - Extra Details : **' + oldRow.fields.details + '**' +
           ' - Created By: *' + res[0].character_name + '*~~';
           bot.sendMessage(announceChannelID, message);
           winston.info('deleted fleet timer announced on Discord');
         }
       });
     }
   }
 );

var structureTimers = conEvents.add(
  config.mysqlDatabase + '.timerboard_timer',
  function (oldRow, newRow) {
    var message = '';
    // insert
    if (oldRow === null) {
      con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
        if (err) winston.error(err);
        if (res.length > 0) {
          var eveTime = moment(newRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
          message = '**Structure Timer Added** - **' + newRow.fields.objective + '**: ' +
          ' - Details: **' + newRow.fields.details + '**' +
          ' - Structure: **' + newRow.fields.structure + '**' +
          ' - System: **' + newRow.fields.system + '**' +
          ' - Planet/Moon: **' + newRow.fields.planet_moon + '**' +
          ' - EVE Time: **' + eveTime + '**' +
          ' - Created By: *' + res[0].character_name + '*';
          bot.sendMessage(announceChannelID, message);
          winston.info('new structure timer announced on Discord');
        }
      });
    }
    // update
    else if (newRow !== null && oldRow !== null) {
      // todo
    }
    // delete
    else if (newRow === null) {
      con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
        if (err) winston.error(err);
        if (res.length > 0) {
          var eveTime = moment(oldRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
          message = '**Structure Timer Deleted** - ~~**' + oldRow.fields.objective + '**: ' +
          ' - Details: **' + oldRow.fields.details + '**' +
          ' - Structure: **' + oldRow.fields.structure + '**' +
          ' - System: **' + oldRow.fields.system + '**' +
          ' - Planet/Moon: **' + oldRow.fields.planet_moon + '**' +
          ' - EVE Time: **' + eveTime + '**' +
          ' - Created By: *' + res[0].character_name + '*~~';
          bot.sendMessage(announceChannelID, message);
          winston.info('deleted structure timer announced on Discord');
        }
      });
    }
  }
);

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

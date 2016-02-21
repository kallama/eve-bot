var mysql = require('mysql');
var mysqlEvents = require('mysql-events');
var discord = require('discord.js');
var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var moment = require('moment');
var numeral = require('numeral');
var CronJob = require('cron').CronJob;
var Datastore = require('nedb');
var config = require('./config.js');

var botID = 0;
var message = '';
var zkillboardKillLink = 'zkillboard.com/kill/';


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
var db = new Datastore({ filename: 'timers.db', autoload: true });
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

bot.on('message', function(message) {
  // don't react to own message, duh
  if (message.author.id === botID) {
    return;
  }
  // message contains zkillboard kill link
  if (message.content.indexOf(zkillboardKillLink) !== -1) {
    if (config.zkillLinks === true) {
      displayZkillboardLink(message.content, message.channel);
    }
  }
});

bot.on('presence', function(user, status, gameID) {
  if (status === 'online') {
    checkUsername(user);
  }
});

bot.on('serverNewMember', function(server, user) {
  message = 'New User: ' + user.username + ' joined Discord';
  bot.sendMessage(config.adminChannelID, message);
  checkUsername(user);
});

bot.on('serverMemberRemoved', function(server, user) {
  message = 'User Deleted: ' + user.username + ' was removed from Discord';
  bot.sendMessage(config.adminChannelID, message);
});

bot.on('userBanned', function(server, user) {
  message = 'User Banned: ' + user.username + ' was banned from Discord';
  bot.sendMessage(config.adminChannelID, message);
});

bot.on('userUnbanned', function(server, user) {
  message = 'User Unbanned: ' + user.username + ' was unbanned from Discord';
  bot.sendMessage(config.adminChannelID, message);
});

bot.on('error', function(error) {
  winston.error(error);
});

bot.login(config.email, config.password);

/**
 * MYSQL EVENTS
 */

var fleetTimers = conEvents.add(
  config.mysqlDatabase + '.optimer_optimer', function (oldRow, newRow) {
   var message = '';
   // insert
   if (oldRow === null) {
     con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
       if (err) winston.error(err);
       if (res.length > 0) {
         var eveTime = moment(newRow.fields.start).format('YYYY-MM-DD HH:mm:ss');
         message = ' - ' + newRow.fields.operation_name + ': ' +
         ' - Doctrine: **' + newRow.fields.doctrine + '**' +
         ' - System: **' + newRow.fields.system + '**' +
         ' - Location: **' + newRow.fields.location + '**' +
         ' - Start Time: **' + eveTime + '**' +
         ' - Duration: **' + newRow.fields.duration + '**' +
         ' - Fleet Commander **: ' + newRow.fields.fc + '**' +
         ' - Extra Details : **' + newRow.fields.details + '**';
         // track timer
         addTimer(message, newRow.fields.start, 'fleet', newRow.fields.id);
         // add first part
         message = '**Fleet Timer Added**' + message + ' - Created By: *' + res[0].character_name + '*';
         bot.sendMessage(config.announceChannelID, message);
         winston.info('new fleet timer announced on Discord');


       }
     });
   }
   // update
   else if (newRow !== null && oldRow !== null) {
     con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
       if (err) winston.error(err);
       if (res.length > 0) {
         var eveTime = moment(newRow.fields.start).format('YYYY-MM-DD HH:mm:ss');
         message = ' - ' + newRow.fields.operation_name + ': ' +
         ' - Doctrine: **' + newRow.fields.doctrine + '**' +
         ' - System: **' + newRow.fields.system + '**' +
         ' - Location: **' + newRow.fields.location + '**' +
         ' - Start Time: **' + eveTime + '**' +
         ' - Duration: **' + newRow.fields.duration + '**' +
         ' - Fleet Commander **: ' + newRow.fields.fc + '**' +
         ' - Extra Details : **' + newRow.fields.details + '**';
         // track timer
         updateTimer(message, newRow.fields.start, 'fleet', newRow.fields.id);
         // add first part
         message = '**Fleet Timer Updated**' + message + ' - Created By: *' + res[0].character_name + '*';
         bot.sendMessage(config.announceChannelID, message);
         winston.info('updated fleet timer announced on Discord');
       }
     });
   }
   // delete
   else if (newRow === null) {
     con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
       if (err) winston.error(err);
       if (res.length > 0) {
         // don't announce deletion of expire fleet
         var now = new Date();
         var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
         var timer = new Date(oldRow.fields.eve_time);
         if (now_utc > timer) {
           return;
         }
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
         // track timer
         deleteTimer(oldRow.fields.id);
         bot.sendMessage(config.announceChannelID, message);
         winston.info('deleted fleet timer announced on Discord');
       }
     });
   }
  }
);

var structureTimers = conEvents.add(
  config.mysqlDatabase + '.timerboard_timer', function (oldRow, newRow) {
    var message = '';
    // insert
    if (oldRow === null) {
      con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
        if (err) winston.error(err);
        if (res.length > 0) {
          if (newRow.fields.corp_timer === 1) {
            return;
          }
          var eveTime = moment(newRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
          message = ' - **' + newRow.fields.objective + '**: ' +
          ' - Details: **' + newRow.fields.details + '**' +
          ' - Structure: **' + newRow.fields.structure + '**' +
          ' - System: **' + newRow.fields.system + '**' +
          ' - Planet/Moon: **' + newRow.fields.planet_moon + '**' +
          ' - EVE Time: **' + eveTime + '**';
          if (newRow.fields.important === 1) {
            message += ' | **CTA CTA THIS IS *IMPORTANT* :FROGSIREN:**';
          }
          // track timer
          addTimer(message, newRow.fields.eve_time, 'structure', newRow.fields.id);
          // add first part
          message = '**Structure Timer Added**' + message + ' - Created By: *' + res[0].character_name + '*';
          bot.sendMessage(config.announceChannelID, message);
          winston.info('new structure timer announced on Discord');
        }
      });
    }
    // update
    else if (newRow !== null && oldRow !== null) {
      con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [newRow.fields.eve_character_id], function(err, res) {
        if (err) winston.error(err);
        if (res.length > 0) {
          var eveTime = moment(newRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
          message = '**Structure Timer Updated** - **' + newRow.fields.objective + '**: ' +
          ' - Details: **' + newRow.fields.details + '**' +
          ' - Structure: **' + newRow.fields.structure + '**' +
          ' - System: **' + newRow.fields.system + '**' +
          ' - Planet/Moon: **' + newRow.fields.planet_moon + '**' +
          ' - EVE Time: **' + eveTime + '**';
          if (newRow.fields.important === 1) {
            message += ' | **CTA CTA THIS IS *IMPORTANT* :FROGSIREN:**';
          }
          // track timer
          updateTimer(message, newRow.fields.eve_time, 'fleet', newRow.fields.id);
          // add first part
          message = '**Structure Timer Updated**' + message + ' - Created By: *' + res[0].character_name + '*';
          bot.sendMessage(config.announceChannelID, message);
          winston.info('updated structure timer announced on Discord');
        }
      });
    }
    // delete
    else if (newRow === null) {
      con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
        if (err) winston.error(err);
        if (res.length > 0) {
          // don't announce deletion of expire fleet
          var now = new Date();
          var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
          var timer = new Date(oldRow.fields.eve_time);
          if (now_utc > timer) {
            return;
          }
          var eveTime = moment(oldRow.fields.eve_time).format('YYYY-MM-DD HH:mm:ss');
          message = '**Structure Timer Deleted** - ~~**' + oldRow.fields.objective + '**: ' +
          ' - Details: **' + oldRow.fields.details + '**' +
          ' - Structure: **' + oldRow.fields.structure + '**' +
          ' - System: **' + oldRow.fields.system + '**' +
          ' - Planet/Moon: **' + oldRow.fields.planet_moon + '**' +
          ' - EVE Time: **' + eveTime + '**' +
          ' - Created By: *' + res[0].character_name + '*~~';
          // track timer
          deleteTimer(oldRow.fields.id);
          bot.sendMessage(config.announceChannelID, message);
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
  if (user.id === config.excludeUserID) {
    return;
  }
  con.query('SELECT eveonline_evecharacter.character_name FROM eveonline_evecharacter INNER JOIN authentication_authservicesinfo ON eveonline_evecharacter.character_id = authentication_authservicesinfo.main_char_id WHERE authentication_authservicesinfo.discord_uid = ?', [user.id], function(err, res){
    if (err) winston.error(err);
    var message = '';
    if (res.length > 0) {
      if (user.username !== res[0].character_name) {
        message = 'WARNING: ' + user.username + ' needs to change their Discord name to ' + res[0].character_name;
        bot.sendMessage(user, message);
        bot.sendMessage(config.adminChannelID, message);
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
      bot.sendMessage(config.adminChannelID, message);
      winston.warn(message);
    }
  });
}

function addTimer(message, date, type, timerID) {
  //var dateObj = new Date(date);
  var doc = {
    timer_id: timerID,
    date: date,
    type: type,
    message: message,
    sixty_minute_announce: false,
    thirty_minute_announce: false,
    five_minute_announce: false
  };
  db.insert(doc, function (err, newDoc) {
    if (err) winston.error(err);
    winston.info('timer added to memory db');
  });
}

function updateTimer(message, date, type, timerID) {
  //var dateObj = new Date(date);
  var doc = {
    timer_id: timerID,
    date: date,
    type: type,
    message: message
  };
  db.update({ timer_id: timerID }, { $set: doc }, {}, function (err, numReplaced) {
    if (err) winston.error(err);
    if (numReplaced !== 1) {
      winston.error('update problem to memory db, timer_id ' + timerID);
    }
    else {
      winston.info('timer updated to memory db');
    }
  });
}

function deleteTimer(timerID) {
  db.remove({ timer_id: timerID }, {}, function (err, numRemoved) {
    if (err) winston.error(err);
    if (numRemoved < 1) {
      winston.error('no timer deleted');
    }
    else {
      winston.info('timer deleted from memory db');
    }
  });
}

function announceTimers() {
  db.find({ $or: [{ sixty_minute_announce: false }, { thirty_minute_announce: false }, { five_minute_announce: false }] }, function (err, docs) {
    if (err) winston.error(err);
    var now = new Date();
    var nowUTC = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    _.each(docs, function(doc) {
      var nowUTCModified = nowUTC;
      var timer = new Date(doc.date);
      var message = '';
      if (nowUTC > timer) {
        return;
      }
      if (!doc.sixty_minute_announce) {
        nowUTCModified.setMinutes(nowUTCModified.getMinutes() + 60);
        if (nowUTCModified >= timer) {
          message = '**Operation Starting in 30 minutes**' + doc.message;
          bot.sendMessage(config.announceChannelID, message);
          db.update({ timer_id: doc.timer_id }, { $set: { sixty_minute_announce: true } }, {}, function (err, numReplaced) {
            if (err) winston.error(err);
          });
        }
      }
      else if (!doc.thirty_minute_announce) {
        nowUTCModified = nowUTC;
        nowUTCModified.setMinutes(nowUTCModified.getMinutes() + 30);
        if (nowUTCModified >= timer) {
          message = '**Timer Exits in 30 Minutes*​*' + doc.message;
          bot.sendMessage(config.announceChannelID, message);
          db.update({ timer_id: doc.timer_id }, { $set: { thirty_minute_announce: true } }, {}, function (err, numReplaced) {
            if (err) winston.error(err);
          });
        }
      }
      else if (!doc.five_minute_announce) {
        nowUTCModified = nowUTC;
        nowUTCModified.setMinutes(nowUTCModified.getMinutes() + 5);
        if (nowUTCModified >= timer) {
          message = '**Timer Exits in 5 Minutes*​*' + doc.message;
          bot.sendMessage(config.announceChannelID, message);
          db.update({ timer_id: doc.timer_id }, { $set: { five_minute_announce: true } }, {}, function (err, numReplaced) {
            if (err) winston.error(err);
          });
        }
      }
    });
  });
}

/**
 * [displayZkillboardLink description]
 * @return {[type]} [description]
 */
function displayZkillboardLink(content, channel, displayLink) {
  var killID = content.match(/\/kill\/([0-9]+)/i);
  if (killID === null) {
    return;
  }

  // welcome to callback hell, someone please save me
  request('https://zkillboard.com/api/killID/' + killID[1], function (err, res, body) {
    if (err) winston.error(err);
    if (err || res.statusCode != 200) {
      winstin.info('zkillboard api get failed on killid ' + killID[1]);
      return;
    }
    var jsonArray = JSON.parse(body);
    var json = jsonArray[0];
    con.query('SELECT name FROM eve_inv_types WHERE type_id = ?', [json.victim.shipTypeID], function(err, res) {
      if (err) winston.error(err);
      if (res.length <= 0) {
        winstin.info('shipTypeID ' + json.victim.shipTypeID + ' not found');
        return;
      }
      var shipName = res[0].name;
      con.query('SELECT solarsystem_name, region_name, security FROM eve_map_solarsystems WHERE solarsystem_id = ?', [json.solarSystemID], function(err, res) {
        if (err) winston.error(err);
        if (res.length <= 0) {
          winstin.info('solarSystemID ' + json.solarSystemID + ' not found');
          return;
        }
        var eveData = res[0];
        var killer = _.find(json.attackers, function(attacker) {
          return attacker.finalBlow === 1;
        });
        var victimAllianceOrCorp = json.victim.allianceName;
        if (victimAllianceOrCorp === '') {
          victimAllianceOrCorp = json.victim.corporationName;
        }
        var killarAllianceOrCorp = killer.allianceName;
        if (killarAllianceOrCorp === '') {
          killarAllianceOrCorp = killer.corporationName;
        }
        var message = '';
        message = '**' + json.victim.characterName + '** (' + victimAllianceOrCorp + ') lost their **' + shipName + '** in **' + eveData.solarsystem_name + '** (' + eveData.region_name + ') ';
        message += 'killed by **' + killer.characterName + '** (' + killarAllianceOrCorp + ')\n';
        message += 'Damage Taken: **' + numeral(json.victim.damageTaken).format('0,0[.]00') + '** | Pilots Involved: **' + json.attackers.length + '**\n';
        message += 'Ship: **' + shipName + '** | Value: **' + numeral(json.zkb.totalValue).format('0,0[.]00') + '** ISK\n';
        message += 'System: ' + eveData.solarsystem_name + ' <' + round(eveData.security, 2) + '> (' + eveData.region_name + ')';
        if (displayLink) {
          message += '\nhttps://zkillboard.com/kill/' + killID[1] + '/';
        }
        bot.sendMessage(channel, message);
      });
    });
  });
}

function checkZkillRedis(allianceOrCorpID, alliance, zkillPostKills, zkillPostLosses) {
  request('http://redisq.zkillboard.com/listen.php', function (err, res, body) {
    if (err) winston.error(err);
    if (err || res.statusCode != 200) {
      winstin.info('zkillboard redis get failed');
      return;
    }
    var json = JSON.parse(body);
    // nothing new
    if (json.package === null) {
      //console.log('null'); // testing
      return;
    }
    // skip if value 10,000 or less empty pods
    if (json.package.zkb.totalValue <= 10000) {
      return;
    }
    // post losses
    if (config.zkillPostLosses === true) {
      // check if person in an alliance
      if (json.package.killmail.victim.hasOwnProperty('alliance')) {
        if (config.allianceOrCorpID === json.package.killmail.victim.alliance.id) {
          displayZkillboardLink('/kill/' + json.package.killID, config.zkillPostChannelID, true);
          winston.info('posting loss killID ' + json.package.killID);
        }
      }
      else if (json.package.killmail.victim.hasOwnProperty('corporation')) {
        if (config.allianceOrCorpID === json.package.killmail.victim.corporation.id) {
          displayZkillboardLink('/kill/' + json.package.killID, config.zkillPostChannelID, true);
          winston.info('posting loss killID ' + json.package.killID);
        }
      }
    }
    // post kills
    if (config.zkillPostLosses === true) {
      // do I only care about final blows?
      var killer = _.find(json.package.killmail.attackers, function(attacker) {
        // attacker.finalBlow === 1
        if (attacker.hasOwnProperty('alliance')) {
          return (config.allianceOrCorpID === attacker.alliance.id);
        }
        else if (attacker.hasOwnProperty('corporation')) {
          return (config.allianceOrCorpID === attacker.corporation.id);
        }
        return null;
      });
      if (!killer) {
        return;
      }
      displayZkillboardLink('/kill/' + json.package.killID, config.zkillPostChannelID, true);
      winston.info('posting kill killID ' + json.package.killID);
    }
  });
}

//to round to n decimal places
function round(num, places) {
  var multiplier = Math.pow(10, places);
  return Math.round(num * multiplier) / multiplier;
}

/**
 * CRON
 */

new CronJob('*/30 * * * * *', function() {
  announceTimers();
}, null, true, 'Europe/London');

if ((config.zkillPostKills || config.zkillPostLosses) && config.allianceOrCorpID !== 0 && config.zkillPostChannelID !== '') {
  new CronJob('*/2 * * * * *', function() {
   checkZkillRedis(config.allianceOrCorpID, config.alliance, config.zkillPostKills, config.zkillPostLosses);
   }, null, true, 'Europe/London');
}

//setTimeout(function() { console.log("setTimeout: It's been one second!"); }, 120000);*/

/*
CREST ENDPOINTS
https://public-crest.eveonline.com/types/
https://public-crest.eveonline.com/solarsystems/
https://public-crest.eveonline.com/alliances/
https://public-crest.eveonline.com/corporations/ // doesn't work yet
 */


/*request('http://evewho.com/api.php?type=character&name=' + user.username, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var json = JSON.parse(body);
    var message = '';
    if (json.info === null) {
      message = 'ERROR: ' + user.username + ' is not a real eve character name';
      bot.sendMessage(config.adminChannelID, message);
      winston.info(user.username + ' not valid');
    }
  }
});*/

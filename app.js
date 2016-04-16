var mysql = require('mysql');
var discord = require('discord.js');
var request = require('request');
var _ = require('underscore');
var winston = require('winston');
var numeral = require('numeral');
var CronJob = require('cron').CronJob;

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


var bot = new discord.Client();

// Service Modules
if (config.allianceAuthTimers) {
  var allianceAuthTimers = require('./services/allianceAuthTimers.js')(bot, winston, con);
}
if (config.fleetUpTimers) {
  var fleetUp = require('./services/fleetUpTimers.js')(bot, winston);
}

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
  if (message.content.indexOf(zkillboardKillLink) !== -1 && config.zkillLinks === true) {
    displayZkillboardLink(message.content, message.channel);
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
  // exclude another bot, should make this an array to exclude multiple users
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
      winston.error('zkillboard api get failed on killid ' + killID[1]);
      return;
    }
    var jsonArray = JSON.parse(body);
    var json = jsonArray[0];
    con.query('SELECT name FROM eve_inv_types WHERE type_id = ?', [json.victim.shipTypeID], function(err, res) {
      if (err) winston.error(err);
      if (res.length <= 0) {
        winston.error('shipTypeID ' + json.victim.shipTypeID + ' not found');
        return;
      }
      var shipName = res[0].name;
      con.query('SELECT solarsystem_name, region_name, security FROM eve_map_solarsystems WHERE solarsystem_id = ?', [json.solarSystemID], function(err, res) {
        if (err) winston.error(err);
        if (res.length <= 0) {
          winston.error('solarSystemID ' + json.solarSystemID + ' not found');
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
      winston.error('zkillboard redis get failed');
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

if ((config.zkillPostKills || config.zkillPostLosses) && config.allianceOrCorpID !== 0 && config.zkillPostChannelID !== '') {
  new CronJob('*/2 * * * * *', function() {
    checkZkillRedis(config.allianceOrCorpID, config.alliance, config.zkillPostKills, config.zkillPostLosses);
   }, null, true, 'Europe/London');
}

/**
 * Keep MySQL connection alive
 */

setInterval(function () {
  con.query('SELECT 1');
}, 5000);

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
      winston.error(user.username + ' not valid');
    }
  }
});*/

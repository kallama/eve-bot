var mysqlEvents = require('mysql-events');
var moment = require('moment');
var _ = require('underscore');
var CronJob = require('cron').CronJob;
var Datastore = require('nedb');
var config = require('./../config.js');


var dsn = {
  host: config.mysqlHost,
  user: config.mysqlUsername,
  password: config.mysqlPassword
};
var conEvents = mysqlEvents(dsn);

var db = new Datastore({ filename: 'AllianceAuthTimers.db', autoload: true });

module.exports = function(bot, winston, con) {

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
         else {
           winston.error('no newRow.fields.eve_character_id match');
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
         else {
           winston.error('no newRow.fields.eve_character_id match');
         }
       });
     }
     // delete
     else if (newRow === null) {
       con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
         if (err) winston.error(err);
         if (res.length > 0) {
           // delete temp timer
           deleteTimer(oldRow.fields.id);
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
           bot.sendMessage(config.announceChannelID, message);
           winston.info('deleted fleet timer announced on Discord');
         }
         else {
           winston.error('no newRow.fields.eve_character_id match');
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
          else {
            winston.error('no newRow.fields.eve_character_id match');
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
          else {
            winston.error('no newRow.fields.eve_character_id match');
          }
        });
      }
      // delete
      else if (newRow === null) {
        con.query('SELECT character_name FROM eveonline_evecharacter WHERE id = ?', [oldRow.fields.eve_character_id], function(err, res) {
          if (err) winston.error(err);
          if (res.length > 0) {
            // delete temp timer
            deleteTimer(oldRow.fields.id);
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
            bot.sendMessage(config.announceChannelID, message);
            winston.info('deleted structure timer announced on Discord');
          }
          else {
            winston.error('no newRow.fields.eve_character_id match');
          }
        });
      }
    }
  );

  /**
   * FUNCTIONS
   */

  function addTimer(message, date, type, timerID) {
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
   * CRON
   */

  new CronJob('*/30 * * * * *', function() {
    announceTimers();
  }, null, true, 'Europe/London');

};

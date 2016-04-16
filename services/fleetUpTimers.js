var CronJob = require('cron').CronJob;
var Datastore = require('nedb');
var request = require('request');
var _ = require('underscore');
var moment = require('moment');
var config = require('./../config.js');

var db = new Datastore({ filename: 'FleetUpTimers.db', autoload: true });
var cache = new Datastore();

module.exports = function(bot, winston) {

  /**
   * FUNCTIONS
   */

   function getTimers() {
     var url = 'http://api.fleet-up.com/Api.svc/' + config.fleetUpAppKey + '/' + config.fleetUpUserID + '/' + config.fleetUpAPICode + '/Timers';
     if (config.fleetUpGroupID !== 0) {
       url = url + '/' + config.fleetUpGroupID;
     }
     cache.find({}, function(err, docs) {
       if (err) winston.error(err);
       if (docs.length < 1) {
         getNewTimers();
         /*// delete stored timers
         db.remove({}, {multi: true}, function (err, numRemoved) {
            if (err) winston.error(err);
            // get timers
            request(url, function (err, res, body) {
              if (err) winston.error(err);
              if (err || res.statusCode != 200) {
                winston.error('http://api.fleet-up.com api get failed on timer get');
                return;
              }
              var json = JSON.parse(body);
              // store each timer
              _.each(json.Data, function(timer) {
                addTimer(timer);
              });
              // store cache
              var date = moment.utc(json.CachedUntilString);
              cache.insert({CachedUntilUTC: date.unix(), CachedUntilString: json.CachedUntilString}, function (err, newDoc) {
                if (err) winston.error(err);
                winston.info(newDoc);
                winston.info('fleet-up cache stored');
              });
            });
          });*/
       }
       else {
         // check if current time > cache time
         var now = moment();
         var date = moment.unix(docs[0].CachedUntilUTC);
         if (now.diff(date) > 0) {
           getNewTimers();
           winston.info('now > cached time');
         }
         // announce
         db.find({ $or: [{ sixty_minute_announce: false }, { thirty_minute_announce: false }, { five_minute_announce: false }] }, function (err, docs) {
           if (err) winston.error(err);
           var now = moment.utc();
           _.each(docs, function(doc) {
             var message = '';
             var date = moment.utc(doc.ExpiresString);
             var nowModified = moment.utc();
             if (now.diff(date) > 0) {
               return;
             }
             if (!doc.sixty_minute_announce) {
               nowModified.add(60, 'minutes');
               if (nowModified.diff(date) >= 0) {
                 console.log(nowModified.format());
                 console.log(date.format());
                 message = '**Operation Starting in 30 minutes**' + composeMessage(doc);
                 bot.sendMessage(config.announceChannelID, message);
                 winston.info(message);
                 db.update({ TimerId: doc.TimerId }, { $set: { sixty_minute_announce: true } }, {}, function (err, numReplaced) {
                   if (err) winston.error(err);
                 });
               }
             }
             else if (!doc.thirty_minute_announce) {
               nowModified.add(30, 'minutes');
               if (nowModified >= date) {
                 message = '**Timer Exits in 30 Minutes*​*' + composeMessage(doc);
                 bot.sendMessage(config.announceChannelID, message);
                 winston.info(message);
                 db.update({ TimerId: doc.TimerId }, { $set: { thirty_minute_announce: true } }, {}, function (err, numReplaced) {
                   if (err) winston.error(err);
                 });
               }
             }
             else if (!doc.five_minute_announce) {
               nowModified.add(5, 'minutes');
               if (nowModified >= date) {
                 message = '**Timer Exits in 5 Minutes*​*' + composeMessage(doc);
                 bot.sendMessage(config.announceChannelID, message);
                 winston.info(message);
                 db.update({ TimerId: doc.TimerId }, { $set: { five_minute_announce: true } }, {}, function (err, numReplaced) {
                   if (err) winston.error(err);
                 });
               }
             }
           });
         });
       }
     });
   }

   function getNewTimers() {
     var url = 'http://api.fleet-up.com/Api.svc/' + config.fleetUpAppKey + '/' + config.fleetUpUserID + '/' + config.fleetUpAPICode + '/Timers';
     if (config.fleetUpGroupID !== 0) {
       url = url + '/' + config.fleetUpGroupID;
     }
     // get new timers
     db.find({}, function (err, docs) {
       if (err) winston.error(err);
       request(url, function (err, res, body) {
         if (err) winston.error(err);
         if (err || res.statusCode != 200) {
           winston.error('http://api.fleet-up.com api get failed on timer get');
           return;
         }
         var json = JSON.parse(body);
         // check for new timers
         _.each(json.Data, function(timer) {
           var match = false;
           _.each(docs, function(storedTimer) {
             if (timer.TimerId === storedTimer.TimerId) {
               match = true;
             }
           });
           // new timer
           if (!match) {
             addTimer(timer);
           }
           match = false;
         });
         // check for deleted timers
         _.each(docs, function(storedTimer) {
           var match = false;
           _.each(json.Data, function(timer) {
             if (timer.TimerId === storedTimer.TimerId) {
               match = true;
             }
           });
           // deleted timer
           if (!match) {
             deleteTimer(storedTimer);
           }
           match = false;
         });
         updateCache(json);
       });
     });
   }

   function updateCache(json) {
     var date = moment.utc(json.CachedUntilString);
     cache.find({}, function(err, docs) {
       if (docs.length < 1) {
         cache.insert({ CachedUntilUTC: date.unix(), CachedUntilString: json.CachedUntilString }, function (err, newDoc) {
           if (err) winston.error(err);
           winston.info('fleet-up cache stored');
         });
       }
       else {
         cache.update({ _id: docs[0]._id }, { $set: { CachedUntilUTC: date.unix(), CachedUntilString: json.CachedUntilString }}, {}, function (err, numReplaced) {
           if (err) winston.error(err);
           winston.info('fleet-up cache updated');
         });
       }
     });
   }

   function addTimer(timer) {
     var obj = {
       TimerId: timer.TimerId,
       SolarSystem: timer.SolarSystem,
       SolarSystemId: timer.SolarSystemId,
       Planet: timer.Planet,
       Moon: timer.Moon,
       Owner: timer.Owner,
       Type: timer.Type,
       TimerType: timer.TimerType,
       Posted: timer.Posted,
       PostedString: timer.PostedString,
       ExpiresString: timer.ExpiresString,
       GroupId: timer.GroupId,
       Notes: timer.Notes,
       sixty_minute_announce: false,
       thirty_minute_announce: false,
       five_minute_announce: false
     };
     db.insert(obj, function (err, newDoc) {
       if (err) winston.error(err);
       winston.info('fleet-up fleet added to db');
     });
     // anounce new timer
     var message = '**New Timer Created** ' + composeMessage(timer);
     bot.sendMessage(config.announceChannelID, message);
   }

   function deleteTimer(timer) {
     db.remove({ TimerId: timer.TimerId }, {}, function (err, numRemoved) {
       if (err) winston.error(err);
       if (numRemoved < 1) winston.error('no timer deleted');
       else winston.info('timer deleted from memory db');
     });
     // announce deleted timer if fleet time > now
     var now = moment.utc();
     var date = moment.utc(timer.ExpiresString);
     if (now.diff(date) > 0) {
       var message = '**Timer Deleted** ~~' + composeMessage(timer) + '~~';
       bot.sendMessage(config.announceChannelID, message);
     }
   }

   function composeMessage(doc) {
    var message = ' - ' + doc.TimerType.replace(/_/g, ' ') + ' ' +
    '(**' + doc.Type + '**) in ' + doc.SolarSystem + ' (Planet ' + doc.Planet +
    ' Moon ' + doc.Moon + ') - exits at **' + doc.ExpiresString + '** EVE Time';
    return message;
   }

  /**
   * CRON
   */

  new CronJob('*/30 * * * * *', function() {
    getTimers();
    //announceTimers();
  }, null, true, 'Europe/London');
};

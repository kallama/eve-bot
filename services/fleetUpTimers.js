var CronJob = require('cron').CronJob;
var Datastore = require('nedb');
var config = require('./../config.js');

var db = new Datastore({ filename: 'FleetUpTimers.db', autoload: true });

module.exports = function(bot, winston) {
  bot.on('message', function(message) {
    // don't react to own message, duh
    if (message.content === 'ping') {
      console.log('pong');
    }
  });
};

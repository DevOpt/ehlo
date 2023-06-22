'use strict';

var fs = require('fs');
var SMTPServer = require('smtp-server').SMTPServer
  , streamToBuffer = require('stream-to-buffer')
;

function ehlo(options) {
  this.stack = [];
  options = options || {};
  options.port = options.port || 587;
  this.logger = options.logger || require('./logger')
  this.options = options;
}
require('util').inherits(ehlo, require('events').EventEmitter);

ehlo.prototype.start = function start(callback) {
  var that = this;
  callback = callback || function() {};
  this.logger.info('Starting ehlo');
  this.smtp = new SMTPServer({
    banner: 'Welcome to Ehlo SMTP Server'
    , 'logger': {
      info: that.logger.debug
      , debug: that.logger.debug
      , error: that.logger.debug
    }
    , secure: true
    , key: fs.readFileSync(process.env.SERVER_KEY, 'utf8')
    , cert: fs.readFileSync(process.env.SERVER_CERT, 'utf8')
    , ca: [ fs.readFileSync(process.env.SERVER_CA, 'utf8') ]
    , onData: function(stream, session, smtpCallback) {
      streamToBuffer(stream, function(err, buffer) {
        if (err) {
          that.logger.error(err);
        }

        that.process(session, buffer, smtpCallback);
      });
    }
  });

  this.smtp.on('error', function(err) { this.emit('error', err) }.bind(this));

  this.smtp.listen(
    this.options.port
    , function() {
      that.logger.info('Listening on port [' + that.options.port + ']');
      callback();
    }
  );
};

ehlo.prototype.process = function process(smtpSession, buffer, smtpCallback) {
  var idx = 0
    , mail = {}
    , stack = this.stack
    , end = false
    , that = this
  ;
  mail.raw = buffer;

  var smtp = {};
  smtp.send = function smtpSend(code, message) {
    end = true;
    code = code || 250;
    if (code === 250) {
      return smtpCallback(null);
    }
    return smtpCallback({responseCode: code, message: message});
  };
  smtp.session = smtpSession;

  function next() {
    if (idx >= stack.length) {
      that.emit('error', 'No middleware matching');
      return;
    }

    var middleware = stack[idx++];
    middleware(mail, smtp, next);
    if (end) {
      return;
    }
  }

  this.logger.verbose('[%s] processing middlewares', smtp.session.id);
  next();
};

ehlo.prototype.use = function use(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('Use only accept function');
  }
  this.stack.push(fn);

  return this;
};

ehlo.prototype.stop = function stop(callback) {
  this.logger.info('Stopping ehlo');
  this.smtp.close(callback);
};

module.exports = ehlo;

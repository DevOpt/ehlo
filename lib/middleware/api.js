'use strict';
var request = require('request')
  , logger = require('../logger')
;
module.exports = function api() {
  return function(mail, smtp, next) {
    logger.verbose(
      '[%s] Send post request to [' + mail.api + ']'
      , smtp.session.id
    );
    
    logger.info(smtp.session);
    logger.info(mail);

    request.post(
      {
        url: mail.api
        , formData: {
          mail: JSON.stringify(mail.json),
          from: smtp.session.envelope.mailFrom.address,
          to: JSON.stringify(smtp.session.envelope.rcptTo),
        }
      }
      , function(error, response) {
        if (error) {
          logger.error(error);
        }
        var text = '[' + smtp.session.id + '] Mail pushed to ' +
          '[' + mail.api + '] ' +
          'with response [' + response.statusCode + ']'
        ;
        if (response.statusCode === 200) {
          logger.verbose(text);
          return next();
        }

        return require('./smtp')(421, 'Try again later')(mail, smtp);
      }
    );
  };
}

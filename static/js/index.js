'use strict';

const padModals = require('ep_etherpad-lite/static/js/pad_modals.js').padmodals;

const padModalShow = (message, delay) => {
  $("#notification-popup-id p").text(message);
  $('#notification-popup-id h2').addClass('notify_success').text("Success");

  padModals.showModal("ep_sciencemesh-popup");
  padModals.hideOverlay();

  $("#notification-popup-id").delay(`${delay*1000}`).fadeOut('slow');
}

exports.handleClientMessage_COLLABROOM = (hook, context, cb) => {
  console.log(context);

  let notification = JSON.parse(notificationData);
  if (Object.keys(notification).length === 3) {
    let { message, delay, status } = notification;

    if (status >= 200 && status < 400) {
      $('#notification-popup-id h2').addClass('notify_success').text("Success");;
      padModalShow(message, delay);
    }
    else if (status >= 400) {
      $('#notification-popup-id h2').addClass('notify_error').text("Error");;
      padModalShow(message, delay);
    }
  }
  cb(null);
};

exports.documentReady = () => {
  console.log('hi from static assets')
  padModalShow("test_message", 15);
};

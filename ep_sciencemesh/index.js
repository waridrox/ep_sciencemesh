'use strict';

const fs = require('fs');
const apiKey = fs.readFileSync('./APIKEY.txt', 'utf8');
const api = require('etherpad-lite-client')

const wopiURL = "http://192.168.1.8:8880";

const axios = require("axios");

let globalAuthorID = null;
let globalGroupID = null;

let universalPadUsers = [];
let uniqueItems = [];
let isUpdated = 0;

const etherpad = api.connect({
  apikey: apiKey,
  host: 'localhost',
  port: 9001,
})

const postData = async (pad_content) => {

  let metadata = JSON.stringify({
    'authorId': pad_content.author,
    'padId': pad_content.pad.id,
    'apiKey': apiKey
  });

  axios({
    method: "POST",
    url: wopiURL + `/wopi/bridge/${pad_content.pad.id}`,
    data: metadata,
    headers: { 
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': data.length,
      'X-EFSS-Metadata': data,
      'accept': '*/*' 
    },
  })
  .then(function (response) {
    console.log(response);
  })
  .catch(function (response) {
    console.log(response);
  });
};

exports.padLoad = function (pad, context) {
  console.log('Pad was LOADED')
  console.log(pad, context)

  etherpad.createGroup(function (error, data) {
    if(error) console.error('Error during api call for pad: ' + error.message)
    else { 
      console.log('createGroup: ', JSON.stringify(data))

      globalGroupID = data['groupID'];
      console.log('globalGroupID: ', globalGroupID, '\n')
    }
  }) 
}

exports.padUpdate = function (hook_name, context) {
    console.log('Pad was UPDATED', context)

    let argss = {
      padID: context.pad.id
    }

    globalAuthorID = context.author
    etherpad.padUsersCount(argss, function(error, data) {
      if(error) console.error('Error during api call for pad: ' + error.message)
      else {
      console.log('Current number of PadUsers: ', JSON.stringify(data))
      etherpad.padUsers(argss, function(error, data) {
        if(error) console.error('Error during api call for pad: ' + error.message)
        else {
          console.log('List of PadUsers: ', JSON.stringify(data))  
            data['padUsers'].map(iter => {
              universalPadUsers.push(iter.id);
            })
          }
      })

      uniqueItems = [...new Set(universalPadUsers)]
      console.log('Unique items: ', uniqueItems)

      if (isUpdated != uniqueItems.length) {
        console.log('isUpdated length: ', isUpdated)
        console.log('uniqueItems length: ', uniqueItems.length)

        isUpdated = uniqueItems.length;

        let args = {
          groupID: globalGroupID,
          authorID: globalAuthorID,
          validUntil: 1657815968
        };
        
        console.log('groupID: ', globalGroupID, '\n', 'authorID: ', globalAuthorID, '\n')

        etherpad.createSession(args, function (error, data) {
          if(error) console.error('Error during api call for pad: ' + error.message)
          else {
            console.log(JSON.stringify(data))
          } 
        })
      }
      postData(context);
    }
    })

    console.log('\n')

    etherpad.listAllGroups(function (error, data) {
      if(error) console.error('Error during api call for pad: ' + error.message)
      else { 
        console.log('Group list: ', JSON.stringify(data))
      }
    })

    console.log('\n')
}

exports.userLeave = function(hook, session, callback) {
  console.log('%s left pad %s', session.author, session.padId, session);

  callback(new Promise(
    (resolve, reject) => {
        resolve(console.log('USER HAS LEFT THE PAD NOW'))
    }
  ))
  return;
}

exports.padRemove = function (pad_id) {
  console.log('Pad was removed');
}
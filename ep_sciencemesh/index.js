'use strict';

require('dotenv').config({ path: '/.env' })

const fs = require('fs');
const apiKey = fs.readFileSync('./APIKEY.txt', 'utf8');
const api = require('etherpad-lite-client')
const db = require('../src/node/db/DB')

const wopiURL = "http://192.168.1.5:8880";
const webhook = `${wopiURL}/wopi/bridge`;

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

exports.padCreate = function (pad, context) {
  console.log('PAD WAS CREATED, PAD CREATION CONTEXT: ', context, '\n')
}

exports.padLoad = function (pad, context) {
  console.log('Pad was LOADED')
  console.log((context), '\n')
  let contextForAuthor;

  etherpad.createGroup(function (error, data) {
    if(error) console.error('Error during api call for pad: ' + error.message)
    else { 
      console.log('CURRENT PAD USERS: ', (data), '\n')
      
      let currentAuthor = data.padUsers[0].id
      console.log('CURRENT AUTHOR: ', currentAuthor)

      // Appending a current author field to the list of pad params
      if (currentAuthor != null) {
        contextForAuthor = context;
        contextForAuthor = {
          ...contextForAuthor, 
          currentPadAuthor: currentAuthor
        }
        console.log(contextForAuthor)

        // Pushing the pad contents to db (Only valid postgres data types allowed!!)
        db.set('X-EFSS-Metadata', String(contextForAuthor))
      }
    }
  })

  axios({
    method: "POST",
    url: `${webhook}/${context.pad.id}`,
    headers: { 
      'Content-Type': 'application/json; charset=utf-8',
      'X-EFSS-Metadata ': `${contextForAuthor}`,
      'accept': '*/*'
    },
  })
  .then(function (response) {
    console.log(JSON.stringify(response));

    db.get('X-EFSS-Metadata')
    .then(function (response) {
      console.log('X-EFSS-Metadata from DB: ', (response));
    })
    .catch(function (response) {
      console.log((response));
    });

  })
  .catch(function (response) {
    console.log((response));
  });

  console.log('\n')
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
      else console.log('CURRENT PAD USERS: ', (data), '\n')
    })

    // Handle WOPI server call at https://<wopiserver>/wopi/bridge/<padID>
    axios({
      method: "POST",
      url: webhook + `/${context.pad.id}` + '&t=' + 'some_access_token',
      data: context,
      params: {
        close: true
      },
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'X-EFSS-Metadata ': 'this goes to the webhook endpoint',
        'accept': '*/*' 
      },
    })
    .then(function (response) {
      if (response.status == 200)
        console.log('Data sent successfully')
      else 
        console.log(response);
    })
    .catch(function (response) {
      console.log((response));
    });
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

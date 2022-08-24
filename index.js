'use strict';

const axios = require("axios");
const api = require('ep_etherpad-lite/node/db/API');
const db = require('ep_etherpad-lite/node/db/DB');
const Url = require('url-parse');

const getMetadata = async (context) => {
  const getMetadata = await db.get(`efssmetadata:${context.pad.id}:${context.author}`);

  if (getMetadata) {
    const queryParams = getMetadata.split(':');
    const wopiSrc = decodeURIComponent(queryParams[0])
    const wopiHost = Url(wopiSrc).origin;
    const accessToken = queryParams[1];
    
    return [wopiHost, wopiSrc, accessToken];
  }
  else {
    return null;
  }
}

const axiosCall = (wopiHost, wopiSrc, accessToken, padID, close=false) => {
  let axiosURL = `${wopiHost}/wopi/bridge/${padID}?WOPISrc=${wopiSrc}&access_token=${accessToken}`;
  if (close === true) {
    axiosURL += '&close=true';
  }

  axios.post(axiosURL)
  .then((response) => {
    console.log('RESPONSE: ', JSON.stringify(response));
  })
  .catch((error) => {
    console.log('ERROR: ', JSON.stringify(error));
  });
}

const postToWopi = async (context) => {
  const metadata = await getMetadata(context);

  if (metadata != null) {
    const [wopiHost, wopiSrc, accessToken] = metadata;
    axiosCall(wopiHost, wopiSrc, accessToken, context.pad.id);
  }
}

exports.setEFSSMetadata = async (hookName, context) => {
  context.app.post('/setEFSSMetadata', async (req, res) => {
    const query = req.query;
    
    const response = await api.listAllPads();

    if (response.padIDs.length == 0 || (response.padIDs.includes(query.padID) && response.padIDs.length > 0)) {
      if (!query.padID || !query.wopiSrc || !query.accessToken || !query.apikey)
        res.send({code: 1, message:"Insufficient params or null values supplied as arguments!"})
      else {
        await db.set(`efssmetadata:${query.padID}`, `${(query.wopiSrc)}:${query.accessToken}`);
        res.send({code: 0, message:"Content in DB set successfully"});
      }
    }
  });
};

exports.padUpdate = function (hookName, context) {
  postToWopi(context);
}

exports.userJoin = async (hookName, {authorId, displayName, padId}) => {
  const dbkey = `efssmetadata:${padId}`;
  const dbval = await db.get(dbkey);

  if (dbval) {
    await db.set(`${dbkey}:${authorId}`, dbval);
    await db.remove(dbkey);
  }
  else {
    throw new Error('efssmetadata key missing in db!');
  }
}

exports.userLeave = function(hookName, session, callback) {
  const param = {
    author: session.author,
    pad: {
      id: session.padId
    }
  };

  callback(new Promise(
    async (resolve, reject) => {
      const metadata = await getMetadata(param);
      const currentUsers = (api.padUsersCount(session.padId)).padUsersCount;

      if (metadata !== null && currentUsers == 0) {
        const [wopiHost, wopiSrc, accessToken] = metadata;
        axiosCall(wopiHost, wopiSrc, accessToken, session.padId, true);
        await db.remove(`efssmetadata:${session.padId}:${session.author}`)
        
        resolve(console.log('User content from DB cleared successfully!'));
      }
      else {
        reject(console.log('Cannot exit when pad authors are still editing!'));
      }
    }
  ))
  return;
}

exports.padCreate = function (pad, author) {
    console.log(`Pad: ${pad} || Author: ${author}`)
    currentPad = pad.id
    console.log(currentPad)
}

exports.padLoad = function (pad, author) {
    console.log('Pad was LOADED')
    currentPad = pad.id
    console.log(currentPad)
}

exports.padUpdate = function (pad, author) {
    console.log('Pad was UPDATED', pad)
    getData(URL);
}

exports.userLeave = function(hook, session, callback) {
  console.log('%s left pad %s', session.author, session.padId);
}

exports.exportFileName = function(hook, padId, callback){
  callback("cernbox_etherpad_"+padId);
}

exports.padRemove = function (pad_id) {
  console.log('Pad was removed');
}

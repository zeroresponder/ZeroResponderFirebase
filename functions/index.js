const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineString } = require('firebase-functions/params');
admin.initializeApp();

const accountSid = defineString('accountSid');
const authToken = defineString('authToken');
const client = require('twilio')(accountSid, authToken);

exports.call = functions.https.onRequest((req, res) => {
  client.calls
        .create({
           twiml: '<Response><Say>This is an automated ZeroResponder alert. A patient </Say></Response>',
           to: '+14083103927',
           from: '+14083378528'
         })
        .then(call => console.log(call.sid));

  res.json("ok")
})


exports.alertResponders = functions.firestore
  .document("emergencies/{victimId}")
  .onCreate(async(snap, context) => {
    const victim_data = snap.data();

    const users = await admin.firestore().collection("users")
    const snapshot = await users.get();

    snapshot.forEach(doc => {
      console.log(doc.id);
      responder_data = doc.data();
      const comfortable_responses = responder_data['comfortable_responses']
      if (comfortable_responses.includes(victim_data['type'])) {
        console.log("Found a responder")
        //Notify here
      }
    })
  })

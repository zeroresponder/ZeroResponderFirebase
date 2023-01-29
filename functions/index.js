const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineString } = require('firebase-functions/params');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { Configuration, OpenAIApi} = require("openai");
const OPENAI_KEY = defineString("OPENAI_KEY")
admin.initializeApp();

const configuration = new Configuration({
  apiKey: OPENAI_KEY,
})

async function getData() {
  const victim_data = await admin.firestore().collection("emergencies").doc("neelsdying").data()
  return victim_data
}


exports.test = functions.https.onRequest(async(req, res) => {
  console.log(OPENAI_KEY.value())
  const openai = new OpenAIApi(configuration);

  const question = "How old is the patient?"

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "Imagine you are reporting an emergency to 911 regarding a patient. The patient is 27 years old, male, cholesterol of 407, and 130 fasting blood sugar. The operator asks you, " + question + " How do you respond as concisely as possible?",
  })


  res.json((completion.data.choices[0].text));
})


exports.call = functions.https.onRequest(async(req, res) => {
  const resp = new VoiceResponse()
  const gather = resp.gather({
      input: "speech",
      timeout: 5,
      action: "/gather"
    })

  gather.say("Please say your question")

  resp.redirect("/call")

  res.type('text/xml')
  res.send(resp.toString())

})

exports.gather = functions.https.onRequest(async(req, res) => {
  const resp = new VoiceResponse()

  console.log("RECEVIED QUESTION")
  console.log(req.body.SpeechResult)
  const doc_ref = await admin.firestore().collection("emergencies").doc("neelsdying")
  doc_ref.update({
    response: req.body.SpeechResult,
  })

  resp.redirect("/call")

  res.type('text/xml')
  res.send(resp.toString())

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

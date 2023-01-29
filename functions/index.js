const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineString } = require('firebase-functions/params');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { Configuration, OpenAIApi} = require("openai");
const openai_key = defineString("OPENAI_KEY")
admin.initializeApp();
const currentDate = new Date();
const timestamp = currentDate.getTime();

async function getData() {
  return await admin.firestore().collection("emergencies")
    .limit(1)
    .get()
    .then(querySnapshot => {
      if (!querySnapshot.empty) {
        const queryDocumentSnapshot = querySnapshot.docs[0];
        return queryDocumentSnapshot.data();
      } else {
        return "empty"
      }
    })
}


exports.test = functions.https.onRequest(async(req, res) => {
  const data = await getData();
  console.log(data)
  res.send(data)
})


async function getResponse(question) {
  const data = getData()
  const configuration = new Configuration({
    apiKey: openai_key.value(),
  })

  const openai = new OpenAIApi(configuration);

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "Imagine you are reporting an emergency to 911 regarding a patient. The patient is a " + data.age + " " + data.sex + ", " + "has a cholesterol of " + data.chol + "mg/dl and a fasting blood sugar of " + data.fbs + " mg/dl. The operator asks you, '" + question + "' How do you respond as concisely as possible?",
  })


  return (completion.data.choices[0].text)
}


exports.call = functions.https.onRequest(async(req, res) => {
  const resp = new VoiceResponse()
  const gather = resp.gather({
      input: "speech",
      timeout: 3,
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
  if (req.body.SpeechResult) {
    const doc_ref = await admin.firestore().collection("emergencies").doc("neelsdying")
    doc_ref.update({
      response: req.body.SpeechResult,
    })
    const completion = await getResponse(req.body.SpeechResult)
    console.log("AI COMPLETION")
    console.log(completion)
    resp.say(completion)
  }

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

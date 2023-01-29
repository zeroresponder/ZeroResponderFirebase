const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineString } = require('firebase-functions/params');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { Configuration, OpenAIApi} = require("openai");
const twilio = require("twilio")
const openai_key = defineString("OPENAI_KEY")
const accountSid = defineString("TWILIO_ACCOUNT_SID")
const authToken = defineString("TWILIO_AUTH_TOKEN")
admin.initializeApp();


async function getEmergencyDoc() {
  return await admin.firestore().collection("emergencies")
    .limit(1)
    .get()
    .then(querySnapshot => {
      console.log("Documents")
      console.log(querySnapshot.docs)
      if (!querySnapshot.empty) {
        const queryDocumentSnapshot = querySnapshot.docs[0];
        console.log("Found emergency document")
        console.log(queryDocumentSnapshot.id)
        return queryDocumentSnapshot;
      } else {
        return null
      }
    })
}

//
// exports.test = functions.https.onRequest(async(req, res) => {
//   res.send(await getResponse("is the victim concious?"))
// })

async function getResponse(question) {
  const doc_ref = await getEmergencyDoc()
  const data = doc_ref.data()
  const configuration = new Configuration({
    apiKey: openai_key.value(),
  })

  const openai = new OpenAIApi(configuration);

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Imagine you are reporting an emergency to 911 regarding a patient. The patient is a ${data.age} year old ${data.sex} and is suffering from a ${data.emergencyType}. The operator asks you, '${question}' How do you respond as concisely and accurately as possible? Say 'I don't know' if you do not have enough data to accurately respond.`
  })


  return (completion.data.choices[0].text)
}


exports.call = functions.https.onRequest(async(req, res) => {
  console.log("Call accepted")
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

  console.log("Question Received")
  console.log(req.body.SpeechResult)
  if (req.body.SpeechResult) {
    const doc_ref = await getEmergencyDoc()
    console.log("Victim Data")
    console.log(doc_ref)
    console.log(doc_ref.id)
    const previous_responses = doc_ref.data()['responses']
    doc_ref.ref.update({
      responses: [...previous_responses, req.body.SpeechResult],
    })
    const completion = await getResponse(req.body.SpeechResult)
    doc_ref.update({
      responses: [...previous_responses, completion]
    })
    console.log("GPT-3 Response")
    console.log(completion)
    resp.say(completion)
  }

  resp.redirect("/call")

  res.type('text/xml')
  res.send(resp.toString())

})

function dispatchFirstResponders(snap) {
  const client = twilio(accountSid.value(), authToken.value());
  const data = snap.data()
  const message = `This is a ZeroResponder alert. A ${data.age} year old ${data.sex} is suffering from ${data.emergencyType}.`
  client.calls
      .create({
         twiml: `<Response><Say>${message}</Say></Response>`,
         to: '+14083103927',
         from: '+14083378528'
       })
      .then(call => console.log(call.sid));
  snap.ref.update({
    responses: [message]
  })
}

exports.alertResponders = functions.firestore
  .document("emergencies/{victimId}")
  .onCreate(async(snap, context) => {

    const victim_data = snap.data();

    const users = await admin.firestore().collection("users")
    const snapshot = await users.get();

    snapshot.forEach(doc => {
      console.log(doc.id);
      responder_data = doc.data();
      const comfortable_responses = responder_data['willingToRespond']
      if (comfortable_responses) {
        if (comfortable_responses.includes(victim_data['type'])) {
          console.log("Found a responder")
          //Notify here
        }
      }
    })
  })

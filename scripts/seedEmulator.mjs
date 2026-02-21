const host = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
const project = process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? 'prispevkyrodicu';
const url = `http://${host}/${project}/us-central1/seedEmulatorData`;

const response = await fetch(url);
if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}
console.log(await response.text());

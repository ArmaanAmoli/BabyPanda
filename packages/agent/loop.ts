import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['NVIDIA_API_KEY'],
});
const instructions = `
You are Baby Panda a coding agent
`
const model = 'z-ai/glm-5.2';


const response = await client.responses.create({
  model: model,
  instructions: instructions,
});

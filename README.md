# Nyra AI Core

PROJECT: NYRA OS — COMPLETE REBUILD FROM THE GROUND UP

You are rebuilding my AI operating system called NYRA.

IMPORTANT:

This is a COMPLETE REBUILD. Do not assume that previous versions of the project, previous code, previous routes, previous components, previous API integrations, or previous architecture are correct.

I have very limited Lovable credits, so I need you to perform as much of the complete foundation build as possible in ONE implementation pass.

Do not waste credits asking me unnecessary clarification questions.

Make sensible engineering decisions and build the complete foundation described below.

If something requires an external API key that is not available yet, BUILD THE FEATURE ARCHITECTURE AND UI NOW with a clean fallback/mock mode instead of breaking the application.

DO NOT leave the application as a collection of placeholder screens.

The application must run.

==================================================

1. PRODUCT VISION

==================================================

NYRA is a personal AI operating system.

Nyra is NOT supposed to feel like a generic chatbot.

The goal is to create an AI that feels like a personal living intelligence that can:

- listen to the user

- understand natural language

- respond naturally by voice

- remember important information

- route requests to the correct capability

- perform actions

- help organize the user's day

- eventually connect to devices and smart-home systems

- eventually understand visual information through cameras

- provide a single unified interface instead of forcing the user through many disconnected apps

The core philosophy is:

SPEAK → UNDERSTAND → ROUTE → EXECUTE → REMEMBER → RESPOND

Nyra should feel calm, warm, intelligent, elegant, and personal.

She should never feel like a robotic customer-service assistant.

The personality should be:

- calm

- warm

- intelligent

- concise

- confident

- helpful

- slightly luxurious

- natural

- never overly verbose unless the user asks for detail

Nyra should communicate as a trusted personal assistant.

==================================================

2. CORE ARCHITECTURE

==================================================

Build Nyra around four major layers:

1. BRAIN / ENGINE

2. MEMORY

3. VOICE

4. HUD / INTERFACE

These layers should be modular.

The architecture should make it possible to replace one provider or component without rebuilding the entire application.

The system should conceptually work like this:

USER

  ↓

VOICE INPUT / TEXT INPUT

  ↓

NYRA BRAIN

  ↓

INTENT / ROUTER

  ↓

SKILL OR ACTION

  ↓

RESULT

  ↓

MEMORY UPDATE IF APPROPRIATE

  ↓

NYRA RESPONSE

  ↓

VOICE OUTPUT + HUD

Do not make everything one giant component.

Create clean modules/components/services so the system can grow.

==================================================

3. AI PROVIDER

==================================================

PRIMARY AI PROVIDER:

GROQ

We are NOT using xAI.

Do not create xAI integrations.

Do not reference xAI anywhere in the application.

The architecture should support Groq through an OpenAI-compatible chat-completions style API.

Environment variables should include:

GROQ_API_KEY

GROQ_MODEL

Default model:

llama-3.3-70b-versatile

However, do not hard-code the API key anywhere in client-side code.

All secret API keys must remain server-side.

Create a central AI provider abstraction such as:

AIProvider

or

aiService

The rest of the application should communicate with the abstraction instead of directly calling Groq everywhere.

This will allow another provider to be added later without rewriting Nyra.

==================================================

4. NYRA SYSTEM PROMPT

==================================================

Create a centralized Nyra system prompt.

Nyra should behave approximately like:

"You are Nyra, a calm, warm, intelligent personal AI operating system.

You are not a generic chatbot.

You help the user think, organize, remember, plan, and act.

You speak naturally and conversationally.

You should be concise during voice conversations, normally one to three sentences unless the user requests more detail.

You should not repeatedly introduce yourself.

You should not say that you are a language model unless technically necessary.

You should understand that the user may speak naturally, imperfectly, or casually.

When the user asks you to remember something, identify it as a memory candidate.

When the user asks you to perform an action, determine which skill or capability should handle the request.

When no action is required, answer naturally.

Never pretend an action was successfully completed if it was not actually completed.

If an integration is unavailable, explain that clearly and gracefully."

Keep the system prompt centralized so it can be changed later without hunting through multiple files.

==================================================

5. VOICE INPUT

==================================================

Nyra must support microphone input.

Create a voice interaction state machine.

At minimum:

IDLE

LISTENING

PROCESSING

SPEAKING

ERROR

The UI must clearly communicate these states.

Example:

IDLE:

"Sleeping — say 'Hey Nyra' to wake me"

LISTENING:

"Listening..."

PROCESSING:

"Thinking..."

SPEAKING:

"Nyra is speaking..."

ERROR:

"Something went wrong"

The user must also be able to manually start a conversation.

Do not require wake-word functionality for the first version.

Wake word support can be added later.

The architecture should however leave room for a wake-word service.

Use browser microphone APIs where appropriate.

Ask for microphone permission gracefully.

Do not continuously record audio without explicit user interaction.

==================================================

6. SPEECH-TO-TEXT

==================================================

Create a Speech-to-Text abstraction.

The interface should be something like:

transcribeAudio()

or an equivalent service abstraction.

Do not hard-code the STT implementation into the UI.

The first implementation may use browser-supported speech recognition where available.

Create a clean fallback if browser speech recognition is unavailable.

The architecture should allow future providers to be plugged in.

Possible future providers can include local STT.

Do not make local STT a required dependency right now.

==================================================

7. ELEVENLABS TEXT-TO-SPEECH

==================================================

ElevenLabs is the intended TTS provider.

Environment variable:

ELEVENLABS_API_KEY

Never expose this key to the browser.

Create a server-side TTS endpoint/service.

For example:

/api/voice/speak

The frontend should send text to the server.

The server should communicate with ElevenLabs.

The frontend should receive playable audio.

If ELEVENLABS_API_KEY is missing:

DO NOT crash.

Display a clear configuration state.

The rest of Nyra must still work in text mode.

The UI can show:

"Voice output unavailable — add ElevenLabs API key."

Do not pretend ElevenLabs is connected when it is not.

Create a provider abstraction so TTS can later be swapped.

==================================================

8. AI CHAT / REPLY API

==================================================

Create a secure server-side endpoint for AI replies.

Example:

POST /api/voice/reply

Request:

{

  "messages": [

    {

      "role": "user",

      "content": "..."

    }

  ]

}

The server should:

1. validate input

2. load the Groq configuration

3. add the Nyra system prompt

4. send the request to Groq

5. safely handle errors

6. return normalized JSON

Example response:

{

  "text": "..."

}

Do not expose GROQ_API_KEY to the browser.

Keep the provider implementation centralized.

Do not create old xAI compatibility logic.

Do not create unnecessary Gemini logic for the primary build.

The primary architecture is GROQ.

==================================================

9. CONVERSATION ENGINE

==================================================

Create a conversation service that manages:

- current conversation

- recent messages

- user messages

- Nyra messages

- timestamps

- processing state

- errors

The UI should show the conversation naturally but should NOT look like a standard ChatGPT clone.

Voice is the primary interaction.

Text should be available as a secondary fallback/input method.

Keep the last reasonable number of messages in active context.

Do not blindly send unlimited conversation history.

==================================================

10. MEMORY SYSTEM

==================================================

Memory is one of the most important parts of Nyra.

Nyra should not merely answer questions.

Nyra should remember useful information about the user.

Create a structured memory system.

Memory categories can include:

- personal

- preferences

- routines

- goals

- important people

- projects

- tasks

- notes

- facts

- reminders

Create a Memory abstraction.

Example:

Memory {

  id

  type

  content

  importance

  createdAt

  updatedAt

}

The user should be able to say:

"Remember that I prefer..."

"Remember this..."

"Don't forget..."

"What do you remember about me?"

The architecture should recognize memory-related intent.

For the first implementation, use a simple persistent database/storage layer available within the project rather than introducing an unnecessarily expensive external vector database.

If a database is available through the project, use it.

If not, implement a clean local persistence layer as a temporary development fallback.

Do not pretend this is production-grade long-term memory yet.

Design it so a proper database/vector memory system can be added later.

==================================================

11. MEMORY UI

==================================================

Create a Memory section in the application.

The user should be able to see:

- saved memories

- memory category

- when it was saved

- importance

- delete memory

- edit memory if appropriate

Privacy is extremely important.

Do not make memories publicly accessible.

Do not expose memory data through client-side secrets.

==================================================

12. ROUTER / INTENT SYSTEM

==================================================

Nyra needs a routing layer.

The system should conceptually determine:

"What is the user trying to accomplish?"

Possible intents:

CHAT

MEMORY_SAVE

MEMORY_RECALL

TASK_CREATE

TASK_LIST

REMINDER_CREATE

REMINDER_LIST

PLAN_DAY

WEB_SEARCH

SETTINGS

HELP

UNKNOWN

Create a modular skill architecture.

Example:

Skill {

  name

  description

  canHandle()

  execute()

}

Do not implement every skill fully right now.

But create the architecture correctly so new skills can be plugged in.

The first functional skills should include:

- conversation

- memory save

- memory recall

- basic task creation

- basic task listing

==================================================

13. TASKS

==================================================

Create a task system.

Tasks should include:

id

title

description

status

priority

createdAt

dueAt

completedAt

The user should eventually be able to say:

"Add finish my website to my tasks."

"What's on my task list?"

"Mark that task complete."

Implement the basic version now.

==================================================

14. DAILY PLANNING

==================================================

Create a basic "Today" or "Daily Plan" experience.

Nyra should eventually be able to help the user plan their day.

The interface should support:

- today's priorities

- tasks

- completed tasks

- upcoming reminders

- simple daily overview

Do not build a fake calendar integration.

If no calendar integration exists, clearly treat the displayed tasks as Nyra's internal task list.

Calendar integrations can come later.

==================================================

15. HUD / MAIN INTERFACE

==================================================

The primary Nyra screen should feel like an AI operating system, NOT a normal SaaS dashboard.

Create a futuristic but elegant HUD.

Design principles:

- dark background

- subtle gradients

- deep navy / black / midnight tones

- soft blue/purple illumination

- glass-like panels

- restrained animation

- elegant typography

- plenty of breathing room

- premium feel

- not childish

- not cluttered

- not a generic dashboard

The centerpiece should be Nyra's visual intelligence/orb/core.

It should react to state:

IDLE:

slow breathing animation

LISTENING:

more active waveform/orb animation

PROCESSING:

thinking/pulsing animation

SPEAKING:

responsive waveform/energy animation

ERROR:

subtle warning state

Do not overuse animations.

Performance matters.

==================================================

16. MAIN SCREEN CONTENT

==================================================

The main screen should include:

NYRA visual core

Status text

Example:

"Sleeping — say 'Hey Nyra' to wake me"

or:

"Ready"

or:

"Listening..."

or:

"Thinking..."

or:

"Speaking..."

Primary microphone button

Conversation/input area

Recent interaction

Navigation to:

Home

Memory

Tasks

Daily Plan

Skills

Settings

Do not make the navigation overwhelming.

The Home screen should remain the primary experience.

==================================================

17. COMMAND CENTER / SKILLS

==================================================

Create a Skills page.

This is where Nyra's capabilities can be shown.

Examples:

Conversation

Memory

Tasks

Daily Planning

Web Search

Voice

Future Smart Home

Future Vision

Clearly distinguish:

ACTIVE

and

COMING SOON

Do not fake functionality.

For example:

Smart Home:

"Coming soon"

Vision:

"Coming soon"

Camera Safety:

"Coming soon"

This gives the product a clear roadmap without pretending incomplete features are finished.

==================================================

18. SMART HOME ROADMAP

==================================================

Nyra's long-term vision includes smart-home control.

Examples:

lights

thermostat

locks

sensors

music

TV

security devices

other IoT devices

Do NOT implement fake smart-home controls.

Instead create the architecture and UI placeholders for future integrations.

The future architecture should allow:

Nyra → Router → Smart Home Skill → Device Integration

Potential future standards/integrations can be added later.

==================================================

19. VISION / CAMERA ROADMAP

==================================================

Nyra may eventually have visual awareness.

Potential future capabilities:

- camera input

- identify objects

- detect unusual activity

- home safety monitoring

- understand surroundings

- user-requested visual analysis

However:

DO NOT secretly access cameras.

DO NOT activate cameras without explicit user permission.

DO NOT implement surveillance functionality in this first build.

Create a clearly labeled:

"Vision — Coming Soon"

section.

Explain that visual intelligence will be added later with privacy controls.

==================================================

20. PRIVACY

==================================================

Privacy must be a first-class design principle.

Nyra should clearly communicate when:

- microphone is active

- audio is being processed

- voice output is playing

- external AI services are being used

- future camera access is active

Never claim:

"100% private"

unless the actual architecture supports that claim.

Do not log API keys.

Do not expose secrets in browser code.

Do not print sensitive request payloads to production logs.

Avoid storing raw audio unless explicitly required.

==================================================

21. SETTINGS

==================================================

Create a Settings page.

Include:

AI Provider

Voice

Microphone

TTS

Memory

Privacy

Appearance

AI:

Provider:

Groq

Model:

environment-configured model

Voice:

ElevenLabs:

Connected / Not configured

Microphone:

Ready / Permission required

Memory:

Enabled / Disabled

Privacy:

clear explanation of what is stored

Appearance:

Dark mode as the default

==================================================

22. ENVIRONMENT VARIABLES

==================================================

Create/update the environment example file.

Use:

GROQ_API_KEY=

GROQ_MODEL=llama-3.3-70b-versatile

ELEVENLABS_API_KEY=

Do NOT put real secrets into source code.

Do NOT hard-code API keys.

Do NOT expose secret keys through VITE_ variables.

If environment variables are missing, the application should still boot.

==================================================

23. ERROR HANDLING

==================================================

Errors must be human-readable.

Never show raw stack traces to the user.

Examples:

AI unavailable:

"Nyra's brain is temporarily unavailable. Check the AI configuration."

Voice unavailable:

"Voice output isn't configured yet. You can still use Nyra in text mode."

Microphone permission:

"Nyra needs microphone permission to listen."

Network failure:

"Nyra couldn't reach the service. Please try again."

Always keep the application usable when possible.

==================================================

24. LOADING / OFFLINE / FALLBACK STATES

==================================================

The UI must never appear frozen.

Show appropriate states.

AI processing:

"Thinking..."

Voice processing:

"Listening..."

TTS:

"Speaking..."

If no API key is available:

show configuration status rather than crashing.

The application should have a development/demo mode where possible.

In demo mode, do not pretend the AI provider is actually responding.

Clearly label demo responses as demo if they are used.

==================================================

25. RESPONSIVE DESIGN

==================================================

Nyra must work on:

desktop

laptop

tablet

mobile

The primary experience should be excellent on a laptop/desktop.

The mobile layout must still be usable.

The microphone button should be large enough to tap.

Avoid tiny controls.

==================================================

26. ACCESSIBILITY

==================================================

Use:

semantic HTML

keyboard navigation

ARIA labels where appropriate

visible focus states

accessible contrast

buttons with meaningful labels

The microphone button must have an accessible label.

==================================================

27. SECURITY

==================================================

Never expose:

GROQ_API_KEY

ELEVENLABS_API_KEY

to the browser.

All provider API calls that require secret keys must happen server-side.

Validate request payloads.

Limit message size.

Do not allow arbitrary URLs to be fetched by the server without validation.

Do not trust client-provided system prompts.

Do not allow users to override Nyra's internal system prompt through normal chat input.

==================================================

28. DATABASE / PERSISTENCE

==================================================

Use the simplest reliable persistence architecture available in the project.

Do not introduce unnecessary paid infrastructure.

Prioritize:

- conversations

- memories

- tasks

- settings

The schema should be designed so it can grow later.

Potential tables/entities:

users

conversations

messages

memories

tasks

settings

If authentication is not already configured, do not spend the entire implementation on authentication.

Build the core application first.

Use a development/local user identity where necessary.

Structure the code so authentication can be added later.

==================================================

29. COMPONENT ARCHITECTURE

==================================================

Use reusable components.

Suggested structure:

/components

  /nyra

    NyraOrb

    NyraStatus

    VoiceButton

    ConversationPanel

    Waveform

    MemoryPanel

    TaskPanel

    DailyPlan

    SkillCard

    SystemStatus

/services

  ai

  voice

  memory

  tasks

  router

/api

  voice/reply

  voice/speak

Do not create unnecessary duplicate components.

Keep business logic out of visual components when possible.

==================================================

30. IMPORTANT: NO XAI

==================================================

Do NOT add:

xAI

Grok API via xAI

XAI_API_KEY

xai provider

Our AI provider is:

GROQ

Use:

GROQ_API_KEY

and:

GROQ_MODEL

The word "Grok" should only appear if referring to the Groq provider correctly.

Do not confuse Groq with xAI's Grok.

==================================================

31. IMPORTANT: DO NOT OVERBUILD EXTERNAL INTEGRATIONS

==================================================

Because this is a limited-credit build:

DO NOT spend the implementation trying to integrate:

- Stripe

- Kickstarter

- smart-home hardware

- cameras

- Google Calendar

- Gmail

- Spotify

- Alexa

- Home Assistant

- IoT hardware

- payment systems

- social media APIs

Those are future phases.

Build the core Nyra OS architecture first.

==================================================

32. VISUAL IDENTITY

==================================================

Nyra should have a distinct visual identity.

Use the name:

NYRA

Use an elegant futuristic aesthetic.

The interface should feel:

personal

intelligent

calm

premium

slightly mysterious

modern

Avoid copying Jarvis visually.

The inspiration is the architecture and philosophy:

SPEAK

ROUTE

EXECUTE

REMEMBER

But Nyra's interface, wording, branding, and personality must be original.

==================================================

33. LANDING / INTRO EXPERIENCE

==================================================

Create an optional initial welcome state.

Example:

"Meet Nyra."

"Your personal AI operating system."

Then:

"Speak. Think. Remember. Act."

Primary button:

"Start with Nyra"

Secondary option:

"Explore Nyra"

Do not force a long onboarding flow.

Get the user into the actual system quickly.

==================================================

34. HOME EXPERIENCE

==================================================

When the user opens Nyra, the Home screen should immediately communicate:

Nyra is ready.

Example:

"Good afternoon."

"How can I help?"

Then the central orb.

Then microphone control.

Then subtle access to:

Memory

Tasks

Daily Plan

Skills

The Home screen should NOT look like a blank ChatGPT conversation.

It should feel like an operating system.

==================================================

35. CONVERSATION EXPERIENCE

==================================================

When the user speaks:

1. activate listening state

2. capture speech

3. convert speech to text

4. display recognized text

5. send request to Nyra

6. show processing state

7. receive response

8. display response

9. send response to ElevenLabs if configured

10. play audio

11. return to ready/standby state

If TTS is unavailable:

show the response as text and remain functional.

==================================================

36. MEMORY BEHAVIOR

==================================================

Nyra should not save every random sentence as memory.

Only save information when:

- user explicitly asks Nyra to remember it

- information is clearly useful and the system intentionally identifies it as a memory candidate

Examples:

"Remember that I like lavender."

"Remember that my company is called Nyra."

"Remember that I work on Nyra every day."

Memory should be visible and removable.

==================================================

37. FUTURE ROADMAP

==================================================

Create a roadmap conceptually divided into:

PHASE 1:

Core Nyra

- voice

- AI

- conversation

- memory

- tasks

- HUD

PHASE 2:

Personal Intelligence

- deeper memory

- routines

- proactive assistance

- daily briefings

- better planning

PHASE 3:

Connected Nyra

- calendar

- email

- smart home

- external services

- device control

PHASE 4:

Vision

- camera input

- visual understanding

- safety awareness

- contextual environmental intelligence

PHASE 5:

Full Nyra OS

- proactive agent behavior

- advanced automation

- deeper device integrations

- personalized intelligence

Do not build future features as fake working features.

==================================================

38. PERFORMANCE

==================================================

Optimize for a normal laptop.

Avoid:

- huge animation libraries

- unnecessary dependencies

- constantly running effects

- excessive API requests

- infinite polling

- huge conversation payloads

Use lightweight animations.

Only run expensive processes when needed.

==================================================

39. CODE QUALITY

==================================================

Use clean TypeScript.

Avoid:

any

unless absolutely necessary.

Use clear types.

Centralize constants.

Centralize environment configuration.

Create reusable service abstractions.

Add comments only where they explain non-obvious architecture.

Do not generate massive files containing the entire application in one component.

==================================================

40. TEST THE CORE FLOW

==================================================

Before considering the implementation complete, verify the core flow:

OPEN NYRA

↓

HOME SCREEN LOADS

↓

MICROPHONE BUTTON WORKS

↓

USER CAN ENTER TEXT

↓

REQUEST GOES TO SERVER

↓

GROQ PROVIDER IS USED WHEN CONFIGURED

↓

RESPONSE RETURNS

↓

RESPONSE APPEARS IN UI

↓

ELEVENLABS IS USED WHEN CONFIGURED

↓

VOICE RESPONSE PLAYS

↓

APP RETURNS TO READY STATE

Also verify:

MEMORY SAVE

MEMORY VIEW

MEMORY DELETE

TASK CREATE

TASK VIEW

TASK COMPLETE

SETTINGS

ERROR STATES

MISSING API KEYS

==================================================

41. DO NOT BREAK THE APPLICATION IF KEYS ARE MISSING

==================================================

This is extremely important.

If:

GROQ_API_KEY

is missing:

Nyra should still load.

If:

ELEVENLABS_API_KEY

is missing:

Nyra should still load.

The UI should clearly show:

AI: Not configured

or:

Voice: Not configured

instead of crashing.

==================================================

42. FINAL IMPLEMENTATION REQUIREMENT

==================================================

Build the actual working foundation now.

Do NOT respond by merely giving me a plan.

Do NOT create a marketing page instead of the application.

Do NOT create fake buttons that do nothing.

Do NOT build only a visual mockup.

Implement the core functionality.

If a feature cannot be fully connected because an external credential is missing, implement:

- the UI

- the service abstraction

- the server endpoint

- error handling

- configuration detection

- future integration point

so the feature can be activated by adding the appropriate environment variable later.

==================================================

43. PRIORITY ORDER

==================================================

If you encounter implementation constraints, prioritize exactly in this order:

1. Application boots successfully

2. Nyra HUD/Home interface

3. Text conversation

4. Groq AI integration

5. Voice input

6. ElevenLabs TTS

7. Conversation state

8. Memory

9. Tasks

10. Daily Plan

11. Skills architecture

12. Settings

13. Future integrations

Do NOT sacrifice the working core to build future features.

==================================================

44. FINAL PRODUCT PRINCIPLE

==================================================

Nyra is not:

"another AI chatbot."

Nyra is intended to become:

"A personal AI operating system that you can speak to, that understands you, remembers what matters, routes requests to the right capability, and eventually acts across your digital and physical environment."

The first version must establish that foundation.

The central experience is:

SPEAK.

NYRA UNDERSTANDS.

NYRA ROUTES.

NYRA ACTS.

NYRA REMEMBERS.

NYRA RESPONDS.

Build the foundation for that experience now.

==================================================

45. FINAL CHECK

==================================================

After implementing everything, check for:

- TypeScript errors

- broken imports

- missing environment variables

- client/server boundary problems

- exposed API keys

- broken routes

- non-functional buttons

- console errors

- mobile layout issues

- microphone permission handling

- TTS configuration handling

- Groq API error handling

- memory persistence

- task persistence

Fix any errors you introduce before finishing.

Do not replace working architecture with a shortcut simply to make the UI appear finished.

This is the beginning of the Nyra OS rebuild.

Build it as a real foundation that we can continue expanding without having to rebuild the entire application again.

Please make sure that during the build, you update the system to an extent that if it's, if it's a voice, it isolates the voice. Like the voice isolation system should be available so that the voice is completely isolated. When I'm speaking, it can hear me clearly without having to hear all the other words. If I'm speaking English, it's supposed to speak English.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d6abf4dd-285d-4009-955c-e84c74226e61).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

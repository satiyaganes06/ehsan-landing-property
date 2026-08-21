/* -------------------------------------------------------------------------
   components/assistant.js — the floating chat launcher.

   Markup only. The behaviour (open/close, canned replies) stays in
   js/content.js, which finds this widget through [data-assistant]. mount.js
   injects every component before content.js runs, so that lookup still
   succeeds — see the script order at the foot of each page.
   ------------------------------------------------------------------------- */

SITE.define('assistant', () => `
<div class="assistant" data-assistant>
  <button class="assistant__fab" type="button" data-assistant-toggle aria-expanded="false" aria-controls="assistantPanel">
    <span class="assistant__ring" aria-hidden="true"></span>
    <svg class="assistant__icon assistant__icon--chat" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
    <svg class="assistant__icon assistant__icon--close" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
    <span class="sr-only">Open chat assistant</span>
  </button>

  <div class="assistant__panel" id="assistantPanel" role="dialog" aria-label="Ehsan Property assistant" hidden>
    <header class="assistant__head">
      <p class="assistant__title">Ehsan Assistant</p>
      <p class="assistant__status"><span aria-hidden="true"></span> Placeholder — replies are canned, not live</p>
    </header>
    <div class="assistant__log" data-assistant-log>
      <p class="assistant__msg assistant__msg--bot">Hi — I'm a placeholder assistant standing in for the real thing. Ask about a project, or leave a question and our team will follow up by email.</p>
    </div>
    <form class="assistant__form" data-assistant-form>
      <input class="assistant__input" type="text" placeholder="Type a message…" aria-label="Message" data-assistant-input autocomplete="off">
      <button class="assistant__send" type="submit" aria-label="Send">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M13 5l7 7-7 7"/></svg>
      </button>
    </form>
  </div>
</div>`);

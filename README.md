# Dialer

A simple softphone dialer interface designed to run as a pop-up screen in Salesforce.

## What it is

A single self-contained page ([index.html](index.html)) with no dependencies — sized for a compact pop-up window (~360×620) and styled to match Salesforce Lightning.

- Telephone keypad with letter sub-labels, plus direct typing and keyboard shortcuts
- Live formatting of 10-digit US numbers as `(xxx) xxx-xxxx`
- In-call state with pulsing status strip, running timer, and mute / hold / end controls
- Enter starts a call (or ends one), Backspace deletes a digit
- Visible keyboard focus and `prefers-reduced-motion` support

## Try it

Open `index.html` in a browser, or simulate the pop-up size:

```js
window.open('index.html', 'dialer', 'width=360,height=620');
```

## Notes

This is a front-end shell only — there is no telephony backend. Wire the Call / End buttons to your CTI provider (e.g. Salesforce Open CTI `sforce.opencti`) to place real calls.

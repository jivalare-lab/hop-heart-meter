# HoP Nola Heart Meter

Fundraising and outreach tracker for the Heart of Passion Nola Leadership Development Program 2027. Every leader has a heart that fills up as they get closer to the $2,000 goal. Leaders log donations and the businesses they contact; everyone sees the same numbers.

## How it works

- `index.html` is the page, served by GitHub Pages.
- The data lives in a Google Sheet. A small Google Apps Script (`apps-script/Code.gs`) turns that Sheet into the page's backend: the page reads with GET and writes with POST.
- Writing needs the team code. Mentors share it with the leaders.

## Set up the backend (once, about 2 minutes)

1. Open the Google Sheet "HoP Nola Heart Meter (data)".
2. Extensions > Apps Script. Delete what is there and paste all of `apps-script/Code.gs`. Save.
3. In the function menu pick `setup` and press Run. Accept the permissions (it only touches this Sheet).
4. Project Settings (gear) > Script Properties > Add property: `TEAM_CODE` = the code you will give the leaders.
5. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy and copy the Web app URL.
6. Paste that URL into `config.js` as `scriptUrl`, commit and push.

## Change the roster or the goal

Edit the `Settings` tab of the Sheet: `goal` and `leaders` (names separated by commas). The page picks it up on the next refresh.

## Privacy

The page is unlisted (noindex, robots.txt) but anyone with the link can see first names, donor names and amounts. Do not put phone numbers or emails in notes.

## Check before pushing

```
node verificar.js
```

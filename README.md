## Diablo 1 for web browsers!

This project is based on https://github.com/diasurgical/devilution.

Source code to build the WebAssembly modules is here: https://github.com/d07RiV/devilution

I've modified the code to remove all dependencies and exposed the minimal required interface with JS, allowing the game to be compiled into WebAssembly.

Event handling (especially in the menus) had to be modified significantly to fit the JS model.

The project is hosted on https://d07RiV.github.io/diabloweb/ along with spawn.mpq from the shareware version (place it in the public folder to run locally).
This allows shareware version to be played anywhere, even on mobile phones. To play the full game, you must use your own DIABDAT.MPQ that you can obtain
with the original copy of the game from [GoG](url=https://www.gog.com/game/diablo).

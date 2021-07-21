import React from 'react';
import './App.scss';
import classNames from 'classnames';
import ReactGA from 'react-ga';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faDownload } from '@fortawesome/free-solid-svg-icons';
import getPlayerName from './api/savefile';

import { mapStackTrace } from 'sourcemapped-stacktrace';

import create_fs from './fs';
import load_game from './api/loader';
import { SpawnSizes } from './api/load_spawn';
import CompressMpq from './mpqcmp';

import Peer from 'peerjs';

window.Peer = Peer;

if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('UA-43123589-6');
  ReactGA.pageview('/');
}

function reportLink(e, retail) {
  const message = (e.message || "Unknown error") + (e.stack ? "\n" + e.stack : "");
  const url = new URL("https://github.com/d07RiV/diabloweb/issues/new");
  url.searchParams.set("body",
`**Description:**
[Please describe what you were doing before the error occurred]

**App version:**
DiabloWeb ${process.env.VERSION} (${retail ? 'Retail' : 'Shareware'})

**Error message:**
    
${message.split("\n").map(line => "    " + line).join("\n")}

**User agent:**

    ${navigator.userAgent}

**Save file:**
[Please attach the save file, if applicable. The error box should have a link to download the current save you were playing; alternatively, you can open dev console on the game page (F12) and type in ${"`DownloadSaves()`"}]
`);
  return url.toString();
}

function isDropFile(e) {
  if (e.dataTransfer.items) {
    for (let i = 0; i < e.dataTransfer.items.length; ++i) {
      if (e.dataTransfer.items[i].kind === "file") {
        return true;
      }
    }
  } if (e.dataTransfer.files.length) {
    return true;
  }
  return false;
}
function getDropFile(e) {
  if (e.dataTransfer.items) {
    for (let i = 0; i < e.dataTransfer.items.length; ++i) {
      if (e.dataTransfer.items[i].kind === "file") {
        return e.dataTransfer.items[i].getAsFile();
      }
    }
  } if (e.dataTransfer.files.length) {
    return e.dataTransfer.files[0];
  }
}

const TOUCH_MOVE = 0;
const TOUCH_RMB = 1;
const TOUCH_SHIFT = 2;

function findKeyboardRule() {
  for (let sheet of document.styleSheets) {
    for (let rule of sheet.cssRules) {
      if (rule.type === CSSRule.MEDIA_RULE && rule.conditionText === '(min-aspect-ratio: 3/1)') {
        for (let sub of rule.cssRules) {
          if (sub.selectorText === '.App.keyboard .Body .inner') {
            return sub;
          }
        }
      }
    }
  }
}
let keyboardRule = null;
try {
  keyboardRule = findKeyboardRule();
} catch (e) {
}

const Link = ({children, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;

class App extends React.Component {
  files = new Map();
  state = {started: false, loading: false, dropping: 0, has_spawn: false};
  cursorPos = {x: 0, y: 0};

  touchControls = false;
  touchButtons = [null, null, null, null, null, null, null, null, null, null];
  touchCtx = [null, null, null, null, null, null];
  touchMods = [false, false, false, false, false, false];
  touchBelt = [-1, -1, -1, -1, -1, -1];
  maxKeyboard = 0;

  fs = create_fs(true);

  constructor(props) {
    super(props);

    this.setTouch0 = this.setTouch_.bind(this, 0);
    this.setTouch1 = this.setTouch_.bind(this, 1);
    this.setTouch2 = this.setTouch_.bind(this, 2);
    this.setTouch3 = this.setTouchBelt_.bind(this, 3);
    this.setTouch4 = this.setTouchBelt_.bind(this, 4);
    this.setTouch5 = this.setTouchBelt_.bind(this, 5);

    this.setTouch6 = this.setTouch_.bind(this, 6);
    this.setTouch7 = this.setTouch_.bind(this, 7);
    this.setTouch8 = this.setTouch_.bind(this, 8);
    this.setTouch9 = this.setTouch_.bind(this, 9);
  }

  componentDidMount() {
    document.addEventListener("drop", this.onDrop, true);
    document.addEventListener("dragover", this.onDragOver, true);
    document.addEventListener("dragenter", this.onDragEnter, true);
    document.addEventListener("dragleave", this.onDragLeave, true);

    this.fs.then(fs => {
      const spawn = fs.files.get('spawn.mpq');
      if (spawn && SpawnSizes.includes(spawn.byteLength)) {
        this.setState({has_spawn: true});
      }
      if ([...fs.files.keys()].filter(name => name.match(/\.sv$/i)).length) {
        this.setState({save_names: true});
      }
    });
  }

  onDrop = e => {
    const file = getDropFile(e);
    if (file) {
      e.preventDefault();
      if (this.compressMpq) {
        this.compressMpq.start(file);
      } else {
        this.start(file);
      }
    }
    this.setState({dropping: 0});
  }
  onDragEnter = e => {
    e.preventDefault();
    this.setDropping(1);
  }
  onDragOver = e => {
    if (isDropFile(e)) {
      e.preventDefault();
    }
  }
  onDragLeave = e => {
    this.setDropping(-1);
  }
  setDropping(inc) {
    this.setState(({dropping}) => ({dropping: Math.max(dropping + inc, 0)}));
  }

  onError(message, stack) {
    (async () => {
      const errorObject = {message};
      if (this.saveName) {
        errorObject.save = await (await this.fs).fileUrl(this.saveName);
      }
      if (stack) {
        mapStackTrace(stack, stack => {
          this.setState(({error}) => !error && {error: {...errorObject, stack: stack.join("\n")}});
        });
      } else {
        this.setState(({error}) => !error && {error: errorObject});
      }
    })();
  }

  openKeyboard(rect) {
    if (rect) {
      this.showKeyboard = {
        left: `${(100 * (rect[0] - 10) / 640).toFixed(2)}%`,
        top: `${(100 * (rect[1] - 10) / 480).toFixed(2)}%`,
        width: `${(100 * (rect[2] - rect[0] + 20) / 640).toFixed(2)}%`,
        height: `${(100 * (rect[3] - rect[1] + 20) / 640).toFixed(2)}%`,
      };
      this.maxKeyboard = rect[4];
      this.element.classList.add("keyboard");
      Object.assign(this.keyboard.style, this.showKeyboard);
      this.keyboard.focus();
      if (keyboardRule) {
        keyboardRule.style.transform = `translate(-50%, ${(-(rect[1] + rect[3]) * 56.25 / 960).toFixed(2)}vw)`;
      }
    } else {
      this.showKeyboard = false;
      this.element.classList.remove("keyboard");
      this.keyboard.blur();
      this.keyboard.value = "";
      this.keyboardNum = 0;
    }
  }

  setCursorPos(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    this.cursorPos = {
      x: rect.left + (rect.right - rect.left) * x / 640,
      y: rect.top + (rect.bottom - rect.top) * y / 480,
    };
    setTimeout(() => {
      this.game("DApi_Mouse", 0, 0, 0, x, y);
    });
  }

  onProgress(progress) {
    this.setState({progress});
  }

  onExit() {
    if (!this.state.error) {
      window.location.reload();
    }
  }

  setCurrentSave(name) {
    this.saveName = name;
  }

  showSaves = () => {
    if (this.state.save_names === true) {
      this.updateSaves().then(() => this.setState({show_saves: !this.state.show_saves}));
    } else {
      this.setState({show_saves: !this.state.show_saves});
    }
  }
  updateSaves() {
    return this.fs.then(fs => {
      const saves = {};
      [...fs.files.keys()].filter(name => name.match(/\.sv$/i)).forEach(name => {
        saves[name] = getPlayerName(fs.files.get(name).buffer, name);
      });
      this.setState({save_names: saves});
    });
  }
  removeSave(name) {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      (async () => {
        const fs = await this.fs;
        await fs.delete(name.toLowerCase());
        fs.files.delete(name.toLowerCase());
        this.updateSaves();
      })();
    }
  }
  downloadSave(name) {
    this.fs.then(fs => fs.download(name));
  }

  drawBelt(idx, slot) {
    if (!this.canvas) return;
    if (!this.touchButtons[idx]) {
      return;
    }
    this.touchBelt[idx] = slot;
    if (slot >= 0) {
      this.touchButtons[idx].style.display = "block";
      this.touchCtx[idx].drawImage(this.canvas, 205 + 29 * slot, 357, 28, 28, 0, 0, 28, 28);
    } else {
      this.touchButtons[idx].style.display = "none";
    }
  }

  updateBelt(belt) {
    if (belt) {
      const used = new Set();
      let pos = 3;
      for (let i = 0; i < belt.length && pos < 6; ++i) {
        if (belt[i] >= 0 && !used.has(belt[i])) {
          this.drawBelt(pos++, i);
          used.add(belt[i]);
        }
      }
      for (; pos < 6; ++pos) {
        this.drawBelt(pos, -1);
      }
    } else {
      this.drawBelt(3, -1);
      this.drawBelt(4, -1);
      this.drawBelt(5, -1);
    }
  }

  start(file) {
    if (file && file.name.match(/\.sv$/i)) {
      this.fs.then(fs => fs.upload(file)).then(() => {
        this.updateSaves();
      });
      return;
    }
    if (this.state.show_saves) {
      return;
    }
    if (file && !file.name.match(/\.mpq$/i)) {
      window.alert('Please select an MPQ file. If you downloaded the installer from GoG, you will need to install it on PC and use the MPQ file from the installation folder.');
      return;
    }

    document.removeEventListener("drop", this.onDrop, true);
    document.removeEventListener("dragover", this.onDragOver, true);
    document.removeEventListener("dragenter", this.onDragEnter, true);
    document.removeEventListener("dragleave", this.onDragLeave, true);
    this.setState({dropping: 0});

    const retail = !!(file && !file.name.match(/^spawn\.mpq$/i));
    if (process.env.NODE_ENV === 'production') {
      ReactGA.event({
        category: 'Game',
        action: retail ? 'Start Retail' : 'Start Shareware',
      });
    }

    this.setState({loading: true, retail});

    load_game(this, file, !retail).then(game => {
      this.game = game;

      document.addEventListener('mousemove', this.onMouseMove, true);
      document.addEventListener('mousedown', this.onMouseDown, true);
      document.addEventListener('mouseup', this.onMouseUp, true);
      document.addEventListener('keydown', this.onKeyDown, true);
      document.addEventListener('keyup', this.onKeyUp, true);
      document.addEventListener('contextmenu', this.onMenu, true);

      document.addEventListener('touchstart', this.onTouchStart, {passive: false, capture: true});
      document.addEventListener('touchmove', this.onTouchMove, {passive: false, capture: true});
      document.addEventListener('touchend', this.onTouchEnd, {passive: false, capture: true});

      document.addEventListener('pointerlockchange', this.onPointerLockChange);
      window.addEventListener('resize', this.onResize);

      this.setState({started: true});
    }, e => this.onError(e.message, e.stack));
  }

  pointerLocked() {
    return document.pointerLockElement === this.canvas || document.mozPointerLockElement === this.canvas;
  }

  mousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (this.pointerLocked()) {
      this.cursorPos.x = Math.max(rect.left, Math.min(rect.right, this.cursorPos.x + e.movementX));
      this.cursorPos.y = Math.max(rect.top, Math.min(rect.bottom, this.cursorPos.y + e.movementY));
    } else {
      this.cursorPos = {x: e.clientX, y: e.clientY};
    }
    return {
      x: Math.max(0, Math.min(Math.round((this.cursorPos.x - rect.left) / (rect.right - rect.left) * 640), 639)),
      y: Math.max(0, Math.min(Math.round((this.cursorPos.y - rect.top) / (rect.bottom - rect.top) * 480), 479)),
    };
  }

  mouseButton(e) {
    switch (e.button) {
    case 0: return 1;
    case 1: return 4;
    case 2: return 2;
    case 3: return 5;
    case 4: return 6;
    default: return 1;
    }
  }
  eventMods(e) {
    return ((e.shiftKey || this.touchMods[TOUCH_SHIFT]) ? 1 : 0) + (e.ctrlKey ? 2 : 0) + (e.altKey ? 4 : 0) + (e.touches ? 8 : 0);
  }

  onResize = () => {
    document.exitPointerLock();
  }

  onPointerLockChange = () => {
    if (window.screen && window.innerHeight === window.screen.height && !this.pointerLocked()) {
      // assume that the user pressed escape
      this.game("DApi_Key", 0, 0, 27);
      this.game("DApi_Key", 1, 0, 27);
    }
  }

  onMouseMove = e => {
    if (!this.canvas) return;
    const {x, y} = this.mousePos(e);
    this.game("DApi_Mouse", 0, 0, this.eventMods(e), x, y);
    e.preventDefault();
  }

  onMouseDown = e => {
    if (!this.canvas) return;
    if (e.target === this.keyboard) {
      return;
    }
    if (this.touchControls) {
      this.touchControls = false;
      this.element.classList.remove("touch");
    }
    const {x, y} = this.mousePos(e);
    if (window.screen && window.innerHeight === window.screen.height) {
      // we're in fullscreen, let's get pointer lock!
      if (!this.pointerLocked()) {
        this.canvas.requestPointerLock();
      }
    }
    this.game("DApi_Mouse", 1, this.mouseButton(e), this.eventMods(e), x, y);
    e.preventDefault();
  }

  onMouseUp = e => {
    if (!this.canvas) return;
    if (e.target === this.keyboard) {
      //return;
    }
    const {x, y} = this.mousePos(e);
    this.game("DApi_Mouse", 2, this.mouseButton(e), this.eventMods(e), x, y);
    if (e.target !== this.keyboard) {
      e.preventDefault();
    }
  }

  onKeyDown = e => {
    if (!this.canvas) return;
    this.game("DApi_Key", 0, this.eventMods(e), e.keyCode);
    if (!this.showKeyboard && (e.keyCode >= 32 && e.key.length === 1)) {
      this.game("DApi_Char", e.key.charCodeAt(0));
    } else if (e.keyCode === 8 || e.keyCode === 13) {
      this.game("DApi_Char", e.keyCode);
    }
    this.clearKeySel();
    if (!this.showKeyboard) {
      if (e.keyCode === 8 || e.keyCode === 9 || (e.keyCode >= 112 && e.keyCode <= 119)) {
        e.preventDefault();
      }
    }
  }

  onMenu = e => {
    e.preventDefault();
  }

  onKeyUp = e => {
    if (!this.canvas) return;
    this.game("DApi_Key", 1, this.eventMods(e), e.keyCode);
    this.clearKeySel();
  }

  clearKeySel() {
    if (this.showKeyboard) {
      const len = this.keyboard.value.length;
      this.keyboard.setSelectionRange(len, len);
    }
  }

  onKeyboardInner(flags) {
    if (this.showKeyboard) {
      const text = this.keyboard.value;
      let valid;
      if (this.maxKeyboard > 0) {
        valid = (text.match(/[\x20-\x7E]/g) || []).join("").substring(0, this.maxKeyboard);
      } else {
        const maxValue = -this.maxKeyboard;
        if (text.match(/^\d*$/)) {
          this.keyboardNum = Math.min(text.length ? parseInt(text) : 0, maxValue);
        }
        valid = (this.keyboardNum ? this.keyboardNum.toString() : "");
      }
      if (text !== valid) {
        this.keyboard.value = valid;
      }
      this.clearKeySel();
      this.game("text", valid, flags);
    }
  }
  onKeyboard = () => {
    this.onKeyboardInner(0);
  }
  onKeyboardBlur = () => {
    this.onKeyboardInner(1);
  }

  parseFile = e => {
    const files = e.target.files;
    if (files.length > 0) {
      this.start(files[0]);
    }
  }

  parseSave = e => {
    const files = e.target.files;
    if (files.length > 0) {
      this.start(files[0]);
    }
  }

  touchButton = null;
  touchCanvas = null;

  setTouchMod(index, value, use) {
    if (index < 3) {
      this.touchMods[index] = value;
      if (this.touchButtons[index]) {
        this.touchButtons[index].classList.toggle("active", value);
      }
    } else if (use && this.touchBelt[index] >= 0) {
      const now = performance.now();
      if (!this.beltTime || now - this.beltTime > 750) {
        this.game("DApi_Char", 49 + this.touchBelt[index]);
        this.beltTime = now;
      }
    }
  }

  updateTouchButton(touches, release) {
    let touchOther = null;
    if (!this.touchControls) {
      this.touchControls = true;
      this.element.classList.add("touch");
    }
    const btn = this.touchButton;
    for (let {target, identifier, clientX, clientY} of touches) {
      if (btn && btn.id === identifier && this.touchButtons[btn.index] === target) {
        if (touches.length > 1) {
          btn.stick = false;
        }
        btn.clientX = clientX;
        btn.clientY = clientY;
        this.touchCanvas = [...touches].find(t => t.identifier !== identifier);
        if (this.touchCanvas) {
          this.touchCanvas = {clientX: this.touchCanvas.clientX, clientY: this.touchCanvas.clientY};
        }
        delete this.panPos;
        return this.touchCanvas != null;
      }
      const idx = this.touchButtons.indexOf(target);
      if (idx >= 0 && !touchOther) {
        touchOther = {id: identifier, index: idx, stick: true, original: this.touchMods[idx], clientX, clientY};
      }
    }
    if (btn && !touchOther && release && btn.stick) {
      const rect = this.touchButtons[btn.index].getBoundingClientRect();
      const {clientX, clientY} = btn;
      if (clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom) {
        this.setTouchMod(btn.index, !btn.original, true);
      } else {
        this.setTouchMod(btn.index, btn.original);
      }
    } else if (btn) {
      this.setTouchMod(btn.index, false);
    }
    this.touchButton = touchOther;
    if (touchOther) {
      if (touchOther.index < 6) {
        this.setTouchMod(touchOther.index, true);
        if (touchOther.index === TOUCH_MOVE) {
          this.setTouchMod(TOUCH_RMB, false);
        } else if (touchOther.index === TOUCH_RMB) {
          this.setTouchMod(TOUCH_MOVE, false);
        }
        delete this.panPos;
      } else {
        // touching F key
        this.game("DApi_Key", 0, 0, 110 + touchOther.index);
      }
    } else if (touches.length === 2) {
      const x = (touches[1].clientX + touches[0].clientX) / 2, y = (touches[1].clientY + touches[0].clientY) / 2;
      if (this.panPos) {
        const dx = x - this.panPos.x, dy = y - this.panPos.y;
        const step = this.canvas.offsetHeight / 12;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > step) {
          let key;
          if (Math.abs(dx) > Math.abs(dy)) {
            key = (dx > 0 ? 0x25 : 0x27);
          } else {
            key = (dy > 0 ? 0x26 : 0x28);
          }
          this.game("DApi_Key", 0, 0, key);
          // key up is ignored anyway
          this.panPos = {x, y};
        }
      } else {
        this.game("DApi_Mouse", 0, 0, 24, 320, 180);
        this.game("DApi_Mouse", 2, 1, 24, 320, 180);
        this.panPos = {x, y};
      }
      this.touchCanvas = null;
      return false;
    } else {
      delete this.panPos;
    }
    this.touchCanvas = [...touches].find(t => !touchOther || t.identifier !== touchOther.id);
    if (this.touchCanvas) {
      this.touchCanvas = {clientX: this.touchCanvas.clientX, clientY: this.touchCanvas.clientY};
    }
    return this.touchCanvas != null;
  }

  onTouchStart = e => {
    if (!this.canvas) return;
    if (e.target === this.keyboard) {
      return;
    } else {
      this.keyboard.blur();
    }
    e.preventDefault();
    if (this.updateTouchButton(e.touches, false)) {
      const {x, y} = this.mousePos(this.touchCanvas);
      this.game("DApi_Mouse", 0, 0, this.eventMods(e), x, y);
      if (!this.touchMods[TOUCH_MOVE]) {
        this.game("DApi_Mouse", 1, this.touchMods[TOUCH_RMB] ? 2 : 1, this.eventMods(e), x, y);
      }
    }
  }
  onTouchMove = e => {
    if (!this.canvas) return;
    if (e.target === this.keyboard) {
      return;
    }
    e.preventDefault();
    if (this.updateTouchButton(e.touches, false)) {
      const {x, y} = this.mousePos(this.touchCanvas);
      this.game("DApi_Mouse", 0, 0, this.eventMods(e), x, y);
    }
  }
  onTouchEnd = e => {
    if (!this.canvas) return;
    if (e.target === this.keyboard) {
      //return;
    } else {
      e.preventDefault();
    }
    const prevTc = this.touchCanvas;
    this.updateTouchButton(e.touches, true);
    if (prevTc && !this.touchCanvas) {
      const {x, y} = this.mousePos(prevTc);
      this.game("DApi_Mouse", 2, 1, this.eventMods(e), x, y);
      this.game("DApi_Mouse", 2, 2, this.eventMods(e), x, y);

      if (this.touchMods[TOUCH_RMB] && (!this.touchButton || this.touchButton.index !== TOUCH_RMB)) {
        this.setTouchMod(TOUCH_RMB, false);
      }
    }
    if (!document.fullscreenElement) {
      this.element.requestFullscreen();
    }
  }

  setCanvas = e => this.canvas = e;
  setElement = e => this.element = e;
  setKeyboard = e => this.keyboard = e;
  setTouch_(i, e) {
    this.touchButtons[i] = e;
  }
  setTouchBelt_(i, e) {
    this.touchButtons[i] = e;
    if (e) {
      const canvas = document.createElement("canvas");
      canvas.width = 28;
      canvas.height = 28;
      e.appendChild(canvas);
      this.touchCtx[i] = canvas.getContext("2d");
    } else {
      this.touchCtx[i] = null;
    }
  }

  renderUi() {
    const {started, loading, error, progress, has_spawn, save_names, show_saves, compress} = this.state;
    if (show_saves && typeof save_names === "object") {
      const plrClass = ["Warrior", "Rogue", "Sorcerer"];
      return (
        <div className="start">
          <ul className="saveList">
            {Object.entries(save_names).map(([name, info]) => <li key={name}>
              {name}{info ? <span className="info">{info.name} (lv. {info.level} {plrClass[info.cls]})</span> : ""}
              <FontAwesomeIcon className="btnDownload" icon={faDownload} onClick={() => this.downloadSave(name)}/>
              <FontAwesomeIcon className="btnRemove" icon={faTimes} onClick={() => this.removeSave(name)}/>
            </li>)}
          </ul>
          <form>
            <label htmlFor="loadFile" className="startButton">Upload Save</label>
            <input accept=".sv" type="file" id="loadFile" style={{display: "none"}} onChange={this.parseSave}/>
          </form>
          <div className="startButton" onClick={() => this.setState({show_saves: false})}>Back</div>
        </div>
      );
    } else if (compress) {
      return (
        <CompressMpq api={this} ref={e => this.compressMpq = e}/>
      );
    } else if (error) {
      return (
        <Link className="error" href={reportLink(error, this.state.retail)}>
          <p className="header">The following error has occurred:</p>
          <p className="body">{error.message}</p>
          <p className="footer">Click to create an issue on GitHub</p>
          {error.save != null && <a href={error.save} download={this.saveName}>Download save file</a>}
        </Link>
      );
    } else if (loading && !started) {
      return (
        <div className="loading">
          {(progress && progress.text) || 'Loading...'}
          {progress != null && !!progress.total && (
            <span className="progressBar"><span><span style={{width: `${Math.round(100 * progress.loaded / progress.total)}%`}}/></span></span>
          )}
        </div>
      );
    } else if (!started) {
      return (
        <div className="start">
          <p>
            This is a web port of the original Diablo game, based on source code reconstructed by
            GalaXyHaXz and devilution team. The project page with information and links can be found over here <Link href="https://github.com/d07RiV/diabloweb">https://github.com/d07RiV/diabloweb</Link>
          </p>
          <p>
            If you own the original game, you can drop the original DIABDAT.MPQ onto this page or click the button below to start playing.
            The game can be purchased from <Link href="https://www.gog.com/game/diablo">GoG</Link>.
            {" "}<span className="link" onClick={() => this.setState({compress: true})}>Click here to compress the MPQ, greatly reducing its size.</span>
          </p>
          {!has_spawn && (
            <p>
              Or you can play the shareware version for free (50MB download).
            </p>
          )}
          <form>
            <label htmlFor="loadFile" className="startButton">Select MPQ</label>
            <input accept=".mpq" type="file" id="loadFile" style={{display: "none"}} onChange={this.parseFile}/>
          </form>
          <div className="startButton" onClick={() => this.start()}>Play Shareware</div>
          {!!save_names && <div className="startButton" onClick={this.showSaves}>Manage Saves</div>}
        </div>
      );
    }
  }

  render() {
    const {started, error, dropping} = this.state;
    return (
      <div className={classNames("App", {touch: this.touchControls, started, dropping, keyboard: !!this.showKeyboard})} ref={this.setElement}>
        <div className="touch-ui touch-mods">
          <div className={classNames("touch-button", "touch-button-0", {active: this.touchMods[0]})} ref={this.setTouch0}/>
          <div className={classNames("touch-button", "touch-button-1", {active: this.touchMods[1]})} ref={this.setTouch1}/>
          <div className={classNames("touch-button", "touch-button-2", {active: this.touchMods[2]})} ref={this.setTouch2}/>
        </div>
        <div className="touch-ui touch-belt">
          <div className={classNames("touch-button", "touch-button-0")} ref={this.setTouch3}/>
          <div className={classNames("touch-button", "touch-button-1")} ref={this.setTouch4}/>
          <div className={classNames("touch-button", "touch-button-2")} ref={this.setTouch5}/>
        </div>
        <div className="touch-ui fkeys-left">
          <div className={classNames("touch-button", "touch-button-3")} ref={this.setTouch6} />
          <div className={classNames("touch-button", "touch-button-4")} ref={this.setTouch7} />
        </div>
        <div className="touch-ui fkeys-right">
          <div className={classNames("touch-button", "touch-button-5")} ref={this.setTouch8} />
          <div className={classNames("touch-button", "touch-button-6")} ref={this.setTouch9} />
        </div>
        <div className="Body">
          <div className="inner">
            {!error && <canvas ref={this.setCanvas} width={640} height={480}/>}
            <input type="text" className="keyboard" onChange={this.onKeyboard} onBlur={this.onKeyboardBlur} ref={this.setKeyboard} spellCheck={false} style={this.showKeyboard || {}}/>
          </div>
        </div>
        <div className="BodyV">
          {this.renderUi()}
        </div>
      </div>
    );
  }
}

export default App;

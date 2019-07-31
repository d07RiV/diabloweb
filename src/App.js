import React from 'react';
import './App.scss';
import classNames from 'classnames';

import create_fs from './fs';
import load_game from './api/loader';

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

const Link = ({children, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;

class App extends React.Component {
  files = new Map();
  state = {started: false, loading: false, touch: false, dropping: 0};
  cursorPos = {x: 0, y: 0};

  touchButtons = [null, null, null, null, null, null];
  touchCtx = [null, null, null, null, null, null];
  touchMods = [false, false, false, false, false, false];
  touchBelt = [-1, -1, -1, -1, -1, -1];

  fs = create_fs(this);

  constructor(props) {
    super(props);

    this.setTouch0 = this.setTouch_.bind(this, 0);
    this.setTouch1 = this.setTouch_.bind(this, 1);
    this.setTouch2 = this.setTouch_.bind(this, 2);
    this.setTouch3 = this.setTouchBelt_.bind(this, 3);
    this.setTouch4 = this.setTouchBelt_.bind(this, 4);
    this.setTouch5 = this.setTouchBelt_.bind(this, 5);
  }

  componentDidMount() {
    document.addEventListener("drop", this.onDrop, true);
    document.addEventListener("dragover", this.onDragOver, true);
    document.addEventListener("dragenter", this.onDragEnter, true);
    document.addEventListener("dragleave", this.onDragLeave, true);
  }

  onDrop = e => {
    const file = getDropFile(e);
    if (file) {
      e.preventDefault();
      this.start(file);
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

  onError(text) {
    this.setState({error: text});
  }

  openKeyboard(open) {
    if (open) {
      this.keyboard.focus();
    } else {
      this.keyboard.blur();
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

  onProgress({type, loaded, total}) {
    this.setState({progress: loaded / total});
  }

  drawBelt(idx, slot) {
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
    document.removeEventListener("drop", this.onDrop, true);
    document.removeEventListener("dragover", this.onDragOver, true);
    document.removeEventListener("dragenter", this.onDragEnter, true);
    document.removeEventListener("dragleave", this.onDragLeave, true);
    this.setState({dropping: 0});

    this.setState({loading: true});

    load_game(this, file).then(game => {
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
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      window.addEventListener('resize', this.onResize);

      this.setState({started: true});
    }, e => this.onError(e.message));
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
    const {x, y} = this.mousePos(e);
    this.game("DApi_Mouse", 2, this.mouseButton(e), this.eventMods(e), x, y);
    e.preventDefault();
  }

  onKeyDown = e => {
    if (!this.canvas) return;
    this.game("DApi_Key", 0, this.eventMods(e), e.keyCode);
    if (e.keyCode >= 32 && e.key.length === 1) {
      this.game("DApi_Char", e.key.charCodeAt(0));
    }
  }

  onMenu = e => {
    e.preventDefault();
  }

  onKeyUp = e => {
    if (!this.canvas) return;
    this.game("DApi_Key", 1, this.eventMods(e), e.keyCode);
    const text = this.keyboard.value;
    const values = [...Array(15)].map((_, i) => i < text.length ? text.charCodeAt(i) : 0);
    this.game("DApi_SyncText", ...values);
  }

  parseFile = e => {
    const files = e.target.files;
    if (files.length > 0) {
      this.start(files[0]);
    }
  }

  touchButton = null;
  touchCanvas = null;

  onFullscreenChange = () => {
    this.setState({touch: (document.fullscreenElement === this.element)});
  }

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
      this.setTouchMod(touchOther.index, true);
      delete this.panPos;
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
    e.preventDefault();
    if (this.updateTouchButton(e.touches, false)) {
      const {x, y} = this.mousePos(this.touchCanvas);
      this.game("DApi_Mouse", 0, 0, this.eventMods(e), x, y);
    }
  }
  onTouchEnd = e => {
    if (!this.canvas) return;
    e.preventDefault();
    const prevTc = this.touchCanvas;
    this.updateTouchButton(e.touches, true);
    if (prevTc && !this.touchCanvas) {
      const {x, y} = this.mousePos(prevTc);
      this.game("DApi_Mouse", 2, 1, this.eventMods(e), x, y);
      this.game("DApi_Mouse", 2, 2, this.eventMods(e), x, y);
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

  render() {
    const {started, loading, error, progress, dropping, touch} = this.state;
    return (
      <div className={classNames("App", {touch, started, dropping})} ref={this.setElement}>
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
        <div className="Body">
          {!error && (
            <canvas ref={this.setCanvas} width={640} height={480}/>
          )}
        </div>
        <div className="BodyV">
          <input type="text" className="keyboard" ref={this.setKeyboard}/>
          {!!error && (
            <div className="error">{error}</div>
          )}
          {!!loading && !started && !error && (
            <div className="loading">
              Loading...
              {progress != null && <span className="progressBar"><span><span style={{width: `${Math.round(100 * progress)}%`}}/></span></span>}
            </div>
          )}
          {!started && !loading && !error && (
            <div className="start">
              <p>
                This is a web port of the original Diablo game, based on source code reconstructed by
                GalaXyHaXz and devilution team: <Link href="https://github.com/diasurgical/devilution">https://github.com/diasurgical/devilution</Link>
              </p>
              <form>
                <p>
                  If you own the original game, you can drop the original DIABDAT.MPQ onto this page (or <label htmlFor="loadFile" className="link" onClick={this.download}>click here</label>)
                  to start playing. The game can be purchased from <Link href="https://www.gog.com/game/diablo">GoG</Link>.
                </p>
                <input accept=".mpq" type="file" id="loadFile" style={{display: "none"}} onChange={this.parseFile}/>
              </form>
              <p>
                Or you can download and play the shareware version instead (50MB download).
              </p>
              <span className="startButton" onClick={() => this.start()}>Play Shareware</span>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default App;

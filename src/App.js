import React from 'react';
import './App.scss';

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

const Link = ({children, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;

class App extends React.Component {
  files = new Map();
  state = {started: false, loading: false, dropping: 0};
  cursorPos = {x: 0, y: 0};

  fs = create_fs(this);

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

  onRender({images, text, clip}) {
    const ctx = this.renderer;
    if (!ctx) {
      return;
    }
    for (let {x, y, w, h, image, data} of images) {
      if (!image) {
        image = ctx.createImageData(w, h);
        image.data.set(data);
      }
      ctx.putImageData(image, x, y);
    }
    if (text.length) {
      ctx.save();
      ctx.font = 'bold 13px Times New Roman';
      if (clip) {
        const {x0, y0, x1, y1} = clip;
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
      }
      for (let {x, y, text: str, color} of text) {
        const r = ((color >> 16) & 0xFF);
        const g = ((color >> 8) & 0xFF);
        const b = (color & 0xFF);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillText(str, x, y + 22);
      }
      ctx.restore();
    }
  }

  start(file) {
    document.removeEventListener("drop", this.onDrop, true);
    document.removeEventListener("dragover", this.onDragOver, true);
    document.removeEventListener("dragenter", this.onDragEnter, true);
    document.removeEventListener("dragleave", this.onDragLeave, true);
    this.setState({dropping: 0});

    this.renderer = this.canvas.getContext("2d", {alpha: false});
    this.setState({loading: true});

    load_game(this, file).then(game => {
      this.game = game;

      document.addEventListener('mousemove', this.onMouseMove, true);
      document.addEventListener('mousedown', this.onMouseDown, true);
      document.addEventListener('mouseup', this.onMouseUp, true);
      document.addEventListener('keydown', this.onKeyDown, true);
      document.addEventListener('keyup', this.onKeyUp, true);
      document.addEventListener('contextmenu', this.onMenu, true);

      document.addEventListener('touchstart', this.onTouchStart, true);

      document.addEventListener('pointerlockchange', this.onPointerLockChange);
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
    return (e.shiftKey ? 1 : 0) + (e.ctrlKey ? 2 : 0) + (e.altKey ? 4 : 0);
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

  onTouchStart = e => {
    this.touchEvent = true;
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
    if (this.touchEvent) {
      this.element.requestFullscreen();
      this.touchEvent = false;
      this.game("DApi_Mouse", 0, 0, this.eventMods(e), x, y);
    } else if (window.screen && window.innerHeight === window.screen.height) {
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

  setCanvas = e => this.canvas = e;
  setElement = e => this.element = e;
  setKeyboard = e => this.keyboard = e;

  render() {
    const {started, loading, error, progress, dropping} = this.state;
    return (
      <div className={"App" + (started ? " started" : "") + (dropping ? " dropping" : "")} ref={this.setElement}>
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

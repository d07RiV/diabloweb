import React from 'react';
import compress from './compress';

export default class CompressMpq extends React.Component {
  state = {};

  parseFile = e => {
    const files = e.target.files;
    if (files.length > 0) {
      this.start(files[0]);
    }
  }

  onProgress(progress) {
    this.setState({progress});
  }
  onDone = blob => {
    //const blob = new Blob([result], {type: 'binary/octet-stream'});
    const url = URL.createObjectURL(blob);
    this.setState({url});

    const lnk = document.createElement('a');
    lnk.setAttribute('href', url);
    lnk.setAttribute('download', 'DIABDAT.MPQ');
    document.body.appendChild(lnk);
    lnk.click();
    document.body.removeChild(lnk);
  }
  onError(message, stack) {
    const { api } = this.props;
    api.setState({compress: false});
    api.onError(message, stack);
  }

  onClose = () => {
    if (this.state.url) {
      URL.revokeObjectURL(this.state.url);
    }
    this.props.api.setState({compress: false});
  }

  start(file) {
    this.setState({started: true});
    compress(file, (text, loaded, total) => this.onProgress({text, loaded, total}))
      .then(this.onDone, e => this.onError(e.message, e.stack));
  }

  render() {
    const { url, started, progress } = this.state;
    if (url) {
      return (
        <div className="start">
          <p>
            <a href={url} download="DIABDAT.MPQ">Click here if download doesn't start.</a>
          </p>
          <div className="startButton" onClick={this.onClose}>Back</div>
        </div>
      );
    }
    if (started) {
      return (
        <div className="loading">
          {(progress && progress.text) || 'Processing...'}
          {progress != null && !!progress.total && (
            <span className="progressBar"><span><span style={{width: `${Math.round(100 * progress.loaded / progress.total)}%`}}/></span></span>
          )}
        </div>
      );
    }
    return (
      <div className="start">
        <p>
          You can use this tool to reduce the original MPQ to about half its size. It encodes sounds in MP3 format and uses better compression for regular files.
          To begin, click the button below or drop the MPQ onto the page.
        </p>
        <form>
          <label htmlFor="loadFile" className="startButton">Select MPQ</label>
          <input accept=".mpq" type="file" id="loadFile" style={{display: "none"}} onChange={this.parseFile}/>
        </form>
        <div className="startButton" onClick={this.onClose}>Back</div>
      </div>
    );
  }
}

import React, { Component, createRef } from 'react';
import io from 'socket.io-client';

class App extends Component {
  constructor(props) {
    super(props);
    this.localVideoref = createRef();
    this.remoteVideoref = createRef();
    this.socket = null;
    this.candidates = [];

    this.state = {
      offerFlag: false,
      answerFlag: false,
      isConnected: false,
      connectionState: 'N/A'
    };
  };
  componentDidMount() {

    this.socket = io.connect(
      '/webrtcPeer',
      {
        path: '/webrtc',
        query: {}
      }
    );

    this.socket.on('connection-success', success => {
      console.log(success);
    });

    this.socket.on('offerOrAnswer', (sdp) => {
      this.textref.value = JSON.stringify(sdp);

      // set sdp as remote connection
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    this.socket.on('candidate', (candidate) => {
      if (candidate) {
        this.setState({
          answerFlag: true
        });
      }
      console.log('From Peers .....', JSON.stringify(candidate));
      // this.candidates = [...this.candidates, candidate];
      this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    const pc_config = {

      "iceServers": [
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        }
      ]
    };

    this.pc = new RTCPeerConnection(pc_config);

    // triggered when a new candidate is returned
    this.pc.onicecandidate = (e) => {
      // send the candidates to the remote peer
      // see addCandidate below to be triggered on the remote peer
      if (e.candidate) {
        // console.log(JSON.stringify(e.candidate));
        this.sendToPeer('candidate', e.candidate);
      }
    };
    this.pc.oniceconnectionstatechange = (e) => {
      console.log(e.currentTarget.connectionState);
      this.setState({
        isConnected: true,
        connectionState: e.currentTarget.connectionState.toUpperCase()
      });
    };

    // triggered when a stream is added to pc, see below - this.pc.addStream(stream)
    // this.pc.onaddstream = (e) => {
    //   this.remoteVideoref.current.srcObject = e.stream
    // }

    this.pc.ontrack = (e) => {
      this.remoteVideoref.current.srcObject = e.streams[0]
    };

    // called when getUserMedia() successfully returns - see below
    // getUserMedia() returns a MediaStream object (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
    const success = (stream) => {
      window.localStream = stream;
      this.localVideoref.current.srcObject = stream;
      this.pc.addStream(stream);
    };

    // called when getUserMedia() fails - see below
    const failure = (e) => {
      console.log('getUserMedia Error: ', e);
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    // see the above link for more constraint options
    const constraints = {
      audio: true,
      video: true,
      // video: {
      //   width: 1280,
      //   height: 720
      // },
      // video: {
      //   width: { min: 1280 },
      // }
      options: {
        mirror: true,
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload
    });
  };

  createOffer = () => {
    console.log('Offer');
    this.pc.createOffer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1
    })
      .then(sdp => {
        // console.log(JSON.stringify(sdp));

        // set offer sdp as local description
        this.pc.setLocalDescription(sdp);
        this.setState({
          offerFlag: true,
          isConnected: false
        });
        this.sendToPeer('offerOrAnswer', sdp);
      });
  };

  createAnswer = () => {
    console.log('Answer');
    this.pc.createAnswer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1
    })
      .then(sdp => {
        // console.log(JSON.stringify(sdp));

        // set answer sdp as local description
        this.pc.setLocalDescription(sdp);
        this.setState({
          answerFlag: true,
          isConnected: true
        });

        this.sendToPeer('offerOrAnswer', sdp);
      });
  };

  setRemoteDescription = () => {
    const desc = JSON.parse(this.textref.value);
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  };

  addCandidate = () => {
    // retrieve and parse the Candidate copied from the remote peer
    // const candidate = JSON.parse(this.textref.value);
    // console.log('Adding candidate:', candidate);

    // add the candidate to the peer connection
    // this.pc.addIceCandidate(new RTCIceCandidate(candidate));

    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate));
      this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  };

  render() {
    const { offerFlag, answerFlag, isConnected, connectionState } = this.state;
    return (
      <>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'auto',
          flexDirection: 'column',
          backgroundColor: 'lightgrey'
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ textAlign: 'center' }}>YOU</h1>
              <video
                style={{
                  height: 240,
                  width: 240,
                  margin: 20,
                  backgroundColor: 'black'
                }}
                ref={this.localVideoref}
                // muted="muted"
                autoPlay>
              </video>
            </div>
            <div>
              <h1 style={{ textAlign: 'center' }}>RECEIVER</h1>
              <video
                style={{
                  height: 240,
                  width: 240,
                  margin: 20,
                  backgroundColor: 'black'
                }}
                ref={this.remoteVideoref}
                // muted="muted"
                autoPlay>
              </video>
            </div>
          </div>
          {isConnected ? (
            <div>
              {`Connection Status: ${connectionState}`}
            </div>
          ) : (
              <div>
                {offerFlag ? (
                  <div>
                    You have sent an offer!!
                    Waiting for the receiver...
                  </div>
                ) : (
                    <>
                      {answerFlag ? (
                        <div>
                          You receive an offer!!!
                          Tap answer button to accept the call...
                        </div>
                      ) : (
                          <button
                            style={{
                              backgroundColor: 'red',
                              color: 'white',
                              padding: 10,
                              margin: 10,
                              borderRadius: 16
                            }}
                            onClick={this.createOffer}>
                            Offer
                          </button>
                        )}
                      <button
                        style={{
                          backgroundColor: 'green',
                          color: 'white',
                          padding: 10,
                          margin: 10,
                          borderRadius: 16
                        }}
                        onClick={this.createAnswer}
                      >
                        Answer
                     </button>
                    </>
                  )}
              </div>
            )}
          <br />
          <textarea hidden ref={ref => { this.textref = ref }} />
          {/* <br />
        <button onClick={this.setRemoteDescription}>Set Remote Description</button>
        <button onClick={this.addCandidate}>Add Candidate</button> */}
        </div>
        <div style={{ backgroundColor: 'lightgrey', height: '30vh' }}>

        </div>
      </>
    )
  }
}

export default App;

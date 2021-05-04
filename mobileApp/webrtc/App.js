import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';

import io from 'socket.io-client';

const dimensions = Dimensions.get('window');

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null,
      remoteStream: null,
      offerFlag: false,
      answerFlag: false,
      isConnected: false,
      connectionState: 'N/A',
    };

    this.sdp;
    this.socket = null;
    this.candidates = [];
  }

  componentDidMount = () => {
    this.socket = io.connect('https://01e901077093.ngrok.io/webrtcPeer', {
      path: '/webrtc',
      query: {},
    });

    const pc_config = {
      iceServers: [
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com',
        },
      ],
    };

    this.socket.on('connection-success', success => {
      console.log(success);
    });

    this.socket.on('offerOrAnswer', sdp => {
      this.sdp = JSON.stringify(sdp);

      // set sdp as remote description
      this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    this.socket.on('candidate', candidate => {
      // console.log('From Peer... ', JSON.stringify(candidate))
      // this.candidates = [...this.candidates, candidate]
      this.setState({
        answerFlag: true,
      });
      this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    this.pc = new RTCPeerConnection(pc_config);

    this.pc.onicecandidate = e => {
      // send the candidates to the remote peer
      // see addCandidate below to be triggered on the remote peer
      if (e.candidate) {
        // console.log(JSON.stringify(e.candidate))
        this.sendToPeer('candidate', e.candidate);
      }
    };

    // triggered when there is a change in connection state
    this.pc.oniceconnectionstatechange = e => {
      this.setState({
        isConnected: true,
        connectionState: e.currentTarget.connectionState.toUpperCase(),
      });
      console.log(e.currentTarget.connectionState);
    };

    this.pc.onaddstream = e => {
      // this.remoteVideoref.current.srcObject = e.streams[0]
      this.setState({
        remoteStream: e.stream,
      });
    };

    const success = stream => {
      // console.log(stream.toURL());
      this.setState({
        localStream: stream,
      });
      this.pc.addStream(stream);
    };

    const failure = e => {
      console.log('getUserMedia Error: ', e);
    };

    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind === 'videoinput' &&
          sourceInfo.facing === (isFront ? 'front' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      const constraints = {
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: isFront ? 'user' : 'environment',
          optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      };

      mediaDevices.getUserMedia(constraints).then(success).catch(failure);
    });
  };

  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload,
    });
  };

  createOffer = () => {
    console.log('Offer');
    this.pc
      .createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      })
      .then(sdp => {
        // console.log(JSON.stringify(sdp));

        // set offer sdp as local description
        this.pc.setLocalDescription(sdp);
        this.setState({
          offerFlag: true,
          isConnected: false,
        });

        this.sendToPeer('offerOrAnswer', sdp);
      });
  };

  createAnswer = () => {
    console.log('Answer');
    this.pc
      .createAnswer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      })
      .then(sdp => {
        // console.log(JSON.stringify(sdp));

        // set answer sdp as local description
        this.pc.setLocalDescription(sdp);
        this.setState({
          answerFlag: true,
          isConnected: true,
        });

        this.sendToPeer('offerOrAnswer', sdp);
      });
  };

  setRemoteDescription = () => {
    // retrieve and parse the SDP copied from the remote peer
    const desc = JSON.parse(this.sdp);

    // set sdp as remote description
    this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  };

  addCandidate = () => {
    // retrieve and parse the Candidate copied from the remote peer
    // const candidate = JSON.parse(this.textref.value)
    // console.log('Adding candidate:', candidate)

    // add the candidate to the peer connection
    // this.pc.addIceCandidate(new RTCIceCandidate(candidate))

    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate));
      this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  };

  render() {
    const {
      localStream,
      remoteStream,
      offerFlag,
      answerFlag,
      isConnected,
      connectionState: connectionState,
    } = this.state;

    const remoteVideo = remoteStream ? (
      <RTCView
        key={2}
        mirror={true}
        style={{...styles.rtcViewRemote}}
        objectFit="contain"
        streamURL={remoteStream && remoteStream.toURL()}
      />
    ) : null;

    return (
      <SafeAreaView style={{flex: 1}}>
        <StatusBar backgroundColor="blue" barStyle={'dark-content'} />
        <View style={styles.videosContainer}>
          <ScrollView style={styles.scrollView}>
            <View style={styles.remoteVideoStyle}>{remoteVideo}</View>
            {isConnected ? (
              <View style={{margin: 15}}>
                <Text
                  style={styles.textConnectionState}>
                  {`Connection Status: ${connectionState}`}
                </Text>
              </View>
            ) : (
              <>
                {offerFlag ? (
                  <View>
                    <Text>
                      You have sent an offer!! Waiting for the receiver...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonsContainer}>
                    {answerFlag ? (
                      <View style={{flexWrap: 'wrap'}}>
                        <Text>
                          {'You receive an offer!!! \n Tap answer button to \n accept the call...'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{flex: 1}}>
                        <TouchableOpacity
                          style={styles.buttonCall}
                          onPress={this.createOffer}>
                          <Text style={styles.textContent}>Offer</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={{flex: 1}}>
                      <TouchableOpacity
                        style={styles.buttonAnswer}
                        onPress={this.createAnswer}>
                        <Text style={styles.textContent}>Answer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          <View style={styles.localVideoStyle}>
            <View style={{flex: 1}}>
              <TouchableOpacity
                onPress={() => localStream._tracks[1]._switchCamera()}>
                <View>
                  <RTCView
                    key={1}
                    zOrder={0}
                    objectFit="cover"
                    style={{...styles.rtcView}}
                    streamURL={localStream && localStream.toURL()}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  buttonCall: {
    margin: 5,
    paddingVertical: 10,
    backgroundColor: 'red',
    borderRadius: 5,
  },
  buttonAnswer: {
    margin: 5,
    paddingVertical: 10,
    backgroundColor: 'green',
    borderRadius: 5,
  },
  textContent: {
    fontSize: 20,
    textAlign: 'center',
    color: 'white',
  },
  videosContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  remoteVideoStyle: {
    flex: 1,
    width: '100%',
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  localVideoStyle: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 200,
    height: 200,
    backgroundColor: 'black',
  },
  textConnectionState: {
    fontSize: 22, 
    textAlign: 'center', 
    color: 'white'
  },
  rtcView: {
    width: '100%',
    height: 200,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'lightgrey',
    padding: 15,
  },
  rtcViewRemote: {
    width: dimensions.width - 30,
    height: 200,
    backgroundColor: 'black',
  },
});

export default App;

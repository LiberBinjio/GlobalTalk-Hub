/* globals App, io */

"use strict";

const ICE_SERVERS = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
];

const APP_URL = (() => {
	const protocol = "http" + (location.hostname == "localhost" ? "" : "s") + "://";
	return protocol + location.hostname + (location.hostname == "localhost" ? location.port : "");
})();

const USE_AUDIO = true;
const USE_VIDEO = true;

// You can continue using this signalling server or spin up your own.
// Source to code for thiscan be found at https://github.com/vasanthv/talk/blob/master/signalling-server/index.js
const SIGNALLING_SERVER = "https://talk-zxrf.onrender.com";

let signalingSocket = null; /* our socket.io connection to our webserver */
let localMediaStream = null; /* our own microphone / webcam */
let peers = {}; /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
let channel = {}; /* keep track of the peers Info in the channel, indexed by peer_id (aka socket.io id) */
let peerMediaElements = {}; /* keep track of our <video>/<audio> tags, indexed by peer_id */
let dataChannels = {};

window.initiateCall = () => {
	App.userAgent = navigator.userAgent;
	App.isMobileDevice = !!/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(
		App.userAgent.toUpperCase() || ""
	);
	App.isTablet =
		/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(
			App.userAgent.toLowerCase()
		);
	App.isIpad = /macintosh/.test(App.userAgent.toLowerCase()) && "ontouchend" in document;
	App.isDesktop = !App.isMobileDevice && !App.isTablet && !App.isIpad;

	App.roomLink = `${APP_URL}/?room=${App.roomId}`;

	signalingSocket = io(SIGNALLING_SERVER);

	signalingSocket.on("connect", function () {
		App.peerId = signalingSocket.id;

		console.log("peerId: " + App.peerId);

		const userData = {
			peerName: App.name,
			videoEnabled: App.videoEnabled,
			audioEnabled: App.audioEnabled,
			userAgent: App.userAgent,
			isMobileDevice: App.isMobileDevice,
			isTablet: App.isTablet,
			isIpad: App.isIpad,
			isDesktop: App.isDesktop,
		};
		showNotification(App.name + ' has joined the room ' + App.roomId);
		// 注释下面两行决定是否允许本地多开标签页
		// if (localMediaStream) joinChatChannel(App.roomId, userData);
		// else
		setupLocalMedia(function () {
			joinChatChannel(App.roomId, userData);
		});
	});

	signalingSocket.on("disconnect", function () {
		for (let peer_id in peerMediaElements) {
			document.getElementById("videos").removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		for (let peer_id in peers) {
			peers[peer_id].close();
		}

		peers = {};
		peerMediaElements = {};
	});
	// 显示通知
	function showNotification(message) {
		const notificationContainer = document.getElementById("notification-container");
		if (notificationContainer) {
			const notification = document.createElement("div");
			notification.className = "notification";
			notification.innerText = message;
			notificationContainer.appendChild(notification);
			// 4秒后开始淡出
			setTimeout(() => {
				notification.classList.add("fade-out");
			}, 4000);
			// 7秒后移除通知
			setTimeout(() => {
				notificationContainer.removeChild(notification);
			}, 7000);
		} else {
			console.error("Notification container not found.");
		}
	}

	// 添加到全局对象 window
	window.joinChatChannel = function (channel, userData) {
		signalingSocket.emit("join", { channel: channel, userData: userData });
	}

	signalingSocket.on("addPeer", function (config) {
		//console.log("addPeer", config);

		const peer_id = config.peer_id;
		if (peer_id in peers) return;

		channel = config.channel;
		//console.log('[Join] - connected peers in the channel', JSON.stringify(channel, null, 2));

		const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
		peers[peer_id] = peerConnection;

		peerConnection.onicecandidate = function (event) {
			if (event.candidate) {
				signalingSocket.emit("relayICECandidate", {
					peer_id: peer_id,
					ice_candidate: {
						sdpMLineIndex: event.candidate.sdpMLineIndex,
						candidate: event.candidate.candidate,
					},
				});
			}
		};

		peerConnection.onaddstream = function (event) {
			if (!channel[peer_id]["userData"]["userAgent"]) return;

			const remoteMedia = getVideoElement(peer_id);
			peerMediaElements[peer_id] = remoteMedia;
			attachMediaStream(remoteMedia, event.stream);
			resizeVideos();

			for (let peerId in channel) {
				const videoPeerName = document.getElementById(peerId + "_videoPeerName");
				const peerName = channel[peerId]["userData"]["peerName"];
				if (videoPeerName && peerName) {
					videoPeerName.innerHTML = peerName;
				}

				const videoAvatarImg = document.getElementById(peerId + "_videoEnabled");
				const videoEnabled = channel[peerId]["userData"]["videoEnabled"];
				if (videoAvatarImg && !videoEnabled) {
					videoAvatarImg.style.visibility = "invisible";
				}

				const audioEnabledEl = document.getElementById(peerId + "_audioEnabled");
				const audioEnabled = channel[peerId]["userData"]["audioEnabled"];
				if (audioEnabledEl) {
					audioEnabledEl.className = "audioEnabled icon-mic" + (audioEnabled ? "" : "-off");
				}
			}
		};

		peerConnection.ondatachannel = function (event) {
			showNotification(App.name + " joined");
			event.channel.onmessage = (msg) => {
				let dataMessage = {};
				try {
					dataMessage = JSON.parse(msg.data);
					App.handleIncomingDataChannelMessage(dataMessage);
				} catch (err) {
					console.log(err);
				}
			};
		};

		/* Add our local stream */
		peerConnection.addStream(localMediaStream);
		dataChannels[peer_id] = peerConnection.createDataChannel("talk__data_channel");

		if (config.should_create_offer) {
			peerConnection.onnegotiationneeded = () => {
				peerConnection
					.createOffer()
					.then((localDescription) => {
						peerConnection
							.setLocalDescription(localDescription)
							.then(() => {
								signalingSocket.emit("relaySessionDescription", {
									peer_id: peer_id,
									session_description: localDescription,
								});
							})
							.catch(() => {
								this.showNotification("Offer setLocalDescription failed!");
							});
					})
					.catch((error) => {
						console.log("Error sending offer: ", error);
					});
			};
		}
	});

	signalingSocket.on("sessionDescription", function (config) {
		const peer_id = config.peer_id;
		const peer = peers[peer_id];
		const remoteDescription = config.session_description;

		const desc = new RTCSessionDescription(remoteDescription);
		peer.setRemoteDescription(
			desc,
			() => {
				if (remoteDescription.type == "offer") {
					peer.createAnswer(
						(localDescription) => {
							peer.setLocalDescription(
								localDescription,
								() => {
									signalingSocket.emit("relaySessionDescription", {
										peer_id: peer_id,
										session_description: localDescription,
									});
								},
								() => this.showNotification("Answer setLocalDescription failed!")
							);
						},
						(error) => console.log("Error creating answer: ", error)
					);
				}
			},
			(error) => console.log("setRemoteDescription error: ", error)
		);
	});

	signalingSocket.on("iceCandidate", function (config) {
		const peer = peers[config.peer_id];
		const iceCandidate = config.ice_candidate;
		peer.addIceCandidate(new RTCIceCandidate(iceCandidate)).catch((error) => {
			console.log("Error addIceCandidate", error);
		});
	});

	signalingSocket.on("removePeer", function (config) {
		const peer_id = config.peer_id;
		if (peer_id in peerMediaElements) {
			document.getElementById("videos").removeChild(peerMediaElements[peer_id].parentNode);
			resizeVideos();
		}
		if (peer_id in peers) {
			peers[peer_id].close();
		}
		delete dataChannels[peer_id];
		delete peers[peer_id];
		delete peerMediaElements[config.peer_id];

		delete channel[config.peer_id];
		//console.log('removePeer', JSON.stringify(channel, null, 2));
	});
};


// 用于将媒体流附加到元素
const attachMediaStream = (element, stream) => (element.srcObject = stream);
// 设置本地媒体流
function setupLocalMedia(callback, errorback) {
	if (localMediaStream != null) {
		if (callback) callback();
		return;
	}

	navigator.mediaDevices
		.getUserMedia({ audio: USE_AUDIO, video: USE_VIDEO })
		.then((stream) => {
			// 获取到媒体流后，禁用所有轨道
			stream.getTracks().forEach((track) => {
				track.enabled = false;
			});
			localMediaStream = stream;
			const localMedia = getVideoElement(App.peerId, true);
			attachMediaStream(localMedia, stream);
			resizeVideos();
			if (callback) callback();

			navigator.mediaDevices.enumerateDevices().then((devices) => {
				App.videoDevices = devices.filter((device) => device.kind === "videoinput" && device.deviceId !== "default");
				App.audioDevices = devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "default");
			});
		})
		.catch(() => {
			// 显示通知
			showNotification("Camera/Microphone access denied or not found.");
			if (errorback) errorback();
		});
}

const getVideoElement = (peerId, isLocal) => {
	const videoWrap = document.createElement("div");
	videoWrap.className = "video";

	const media = document.createElement("video");
	media.setAttribute("playsinline", true);
	media.autoplay = true;
	media.controls = false;
	if (isLocal) {
		media.setAttribute("id", "selfVideo");
		media.className = "mirror";
		media.muted = true;
		media.volume = 0;
	} else {
		media.mediaGroup = "remotevideo";
	}

	const audioEnabled = document.createElement("i");
	audioEnabled.setAttribute("id", peerId + "_audioEnabled");
	audioEnabled.className = "audioEnabled icon-mic";

	const peerNameEle = document.createElement("div");
	peerNameEle.setAttribute("id", peerId + "_videoPeerName");
	peerNameEle.className = "videoPeerName";
	if (isLocal) {
		peerNameEle.innerHTML = `${App.name ?? ""} (you)`;
	} else {
		peerNameEle.innerHTML = "Unnamed";
	}

	const fullScreenBtn = document.createElement("button");
	fullScreenBtn.className = "icon-maximize";
	fullScreenBtn.addEventListener("click", () => {
		if (videoWrap.requestFullscreen) {
			videoWrap.requestFullscreen();
		} else if (videoWrap.webkitRequestFullscreen) {
			videoWrap.webkitRequestFullscreen();
		}
	});

	const videoAvatarImgSize = App.isMobileDevice ? "100px" : "200px";
	const videoAvatarImg = document.createElement("img");
	videoAvatarImg.setAttribute("id", peerId + "_videoEnabled");
	videoAvatarImg.setAttribute("src", "videoOff.png");
	videoAvatarImg.setAttribute("width", videoAvatarImgSize);
	videoAvatarImg.setAttribute("height", videoAvatarImgSize);
	videoAvatarImg.className = "videoAvatarImg";

	videoWrap.setAttribute("id", peerId);
	videoWrap.appendChild(media);
	videoWrap.appendChild(audioEnabled);
	videoWrap.appendChild(peerNameEle);
	videoWrap.appendChild(fullScreenBtn);
	videoWrap.appendChild(videoAvatarImg);
	document.getElementById("videos").appendChild(videoWrap);
	return media;
};

function startSpeechRecognition(language) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        displaySubtitle(transcript);
    };

    recognition.onspeechend = () => {
        recognition.stop();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error detected: ', event.error);
    };

    recognition.start();
}

function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
    }
}

function displaySubtitle(text) {
    const subtitles = document.getElementById('subtitles');
    subtitles.textContent = text;
    subtitles.style.display = 'block';
    setTimeout(() => {
        subtitles.style.display = 'none';
    }, 3000); // Hide after 3 seconds
}

const resizeVideos = () => {
	const numToString = ["", "one", "two", "three", "four", "five", "six"];
	const videos = document.querySelectorAll("#videos .video");
	document.querySelectorAll("#videos .video").forEach((v) => {
		v.className = "video " + numToString[videos.length];
	});
};

const calcViewPortUnit = () => {
	let vh = document.getElementById("blanket").offsetHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
};
window.addEventListener("resize", calcViewPortUnit);
window.addEventListener("load", calcViewPortUnit);

document.addEventListener("click", () => {
	if (!App.showChat && !App.showSettings) {
		App.hideToolbar = !App.hideToolbar;
	}
	if (App.showSettings && App.showChat) {
		App.showChat = !App.showChat;
		App.showSettings = !App.showSettings;
	}
});

// 创建并触发 webrtcLoaded 事件, 用于告知刷新页面时触发的事件
const event = new Event('webrtcLoaded');  
window.dispatchEvent(event);


const messageFormInput = messageForm.querySelector("#input");
const messageFormButton = messageForm.querySelector("#button");
const messages = document.querySelector("#messages");
var speech_object = null;
var continue_record_flag = null;
var count = 1;
function start_to_talk() {
	count += 1;
	count % 2 == 0 ? continue_record_flag = true : continue_record_flag = false;
	speech_object.lang = 'en';
	continue_record_flag == true ? speech_object.start() : speech_object.stop();
	if (count % 2 == 0) {
	  document.getElementById("mic_button").style.backgroundColor = "#4285f2";
	  document.getElementById("mic_button").style.color = "#ffffff";
  
	}
	else {
	  document.getElementById("mic_button").style.backgroundColor = "#ffffff";
	  document.getElementById("mic_button").style.color = "#4285f2";
	}
  }
window.onload = function () {
	if (!(window.webkitSpeechRecognition) && !(window.speechRecognition)) {
	  warning();
	} else {
	  var original_lang_input = document.getElementById('input'),
		value = "";
	  speech_object = new webkitSpeechRecognition() || _speechRecognition();
	  speech_object.continuous = true;
	  speech_object.interimResults = true;
	  speech_object.lang = target_lang;
  
	  speech_object.onresult = function (event) {
		var input_voice = '';
		for (var i = event.resultIndex; i < event.results.length; ++i) {
		  if (event.results[i].isFinal) {
			const message = document.querySelector("input").value;
			messageFormInput.value = "";
			if (message != "") {
			  socket.emit(
				"message",
				{ message, room, target_lang },
  
				(error) => {
				  if (error) {
				  }
				}
			  );
			}
			// document.getElementById("trans").value=message;
		  } 
		}
	  };
	  // 异常处理
	  speech_object.onerror = function (event) {
		// Either 'No-speech' or 'Network connection error'
		// console.error(event.error);
	  };
  
	  //录音是否继续的标志位
  
	  speech_object.onend = function () {
		// When recognition ends
		original_lang_input.value = '';
		if (continue_record_flag) {
		  speech_object.start();
		}
  
	  };
	}
  }
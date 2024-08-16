/* globals attachMediaStream, Vue, peers, localMediaStream, dataChannels, signalingSocket */
"use strict";

// 处理 URL 中的房间 ID
const searchParams = new URLSearchParams(window.location.search);
let roomId = searchParams.get("room");

if (!roomId) {
	// 生成随机房间 ID
	roomId = Math.random().toString(36).substr(2, 6);
	searchParams.set("room", roomId);
	window.location.search = searchParams.toString();
}

// 创建 Vue 实例
const App = Vue.createApp({
	data() {
		return {
			peerId: "",
			roomId: window.sessionStorage.getItem('roomId') || roomId,  // 从 sessionStorage 获取 roomId
			roomLink: "",
			copyText: "",
			userAgent: "",
			isMobileDevice: false,
			isTablet: false,
			isIpad: false,
			isDesktop: false,
			videoDevices: [],
			audioDevices: [],
			audioEnabled: false,
			videoEnabled: true,
			screenShareEnabled: false,
			showChat: false,
			showSettings: false,
			hideToolbar: true,
			selectedAudioDeviceId: "",
			selectedVideoDeviceId: "",
			name: window.sessionStorage.getItem('name'),  // 从 sessionStorage 获取姓名 
			callInitiated: window.sessionStorage.getItem('inChatRoom') === 'true', // 从 sessionStorage 获取是否在聊天室中
			typing: "",
			chats: [],
			callInitiated: false,
			callEnded: false,
			recognition: null,
			selectedLanguage: 'Speech Language', // 初始值为 "Speech Language"
			languageMap: {
				'en-US': 'English',
				'es-ES': 'Spanish',
				'fr-FR': 'French',
				'de-DE': 'German',
				'zh-CN': 'Chinese',
				'ja-JP': 'Japanese',
				'ko-KR': 'Korean',
				'it-IT': 'Italian',
				'ru-RU': 'Russian',
				'pt-PT': 'Portuguese'
			}
			};
	},

	mounted() {
		// 监听到webrtc载入后，初始化通话
		window.addEventListener('webrtcLoaded', () => {  
			if (window.sessionStorage.getItem('inChatRoom') === 'true' &&    
				this.roomId && this.name) {    
				this.initiateCall();    
			}  
		});  
	}, 

	methods: {
		// 初始化通话
		initiateCall() {
			if (!this.roomId) return this.showNotification("Invalid room id");
			if (!this.name) return this.showNotification("Invalid name");

			this.callInitiated = true;
			window.initiateCall();

			// 存储用户姓名和 roomId 到 sessionStorage  
			window.sessionStorage.setItem('inChatRoom', 'true');
			window.sessionStorage.setItem('roomId', this.roomId);
			window.sessionStorage.setItem('name', this.name);
		},
		// 确保摄像头和麦克风处于禁用状态
		// if (localMediaStream) {
		// 	localMediaStream.getAudioTracks().forEach(track => track.enabled = this.audioEnabled);
		// 	localMediaStream.getVideoTracks().forEach(track => track.enabled = this.videoEnabled);
		// },
		if(localMediaStream) {
			localMediaStream.getAudioTracks().forEach(track => track.enabled = this.audioEnabled);
			localMediaStream.getVideoTracks().forEach(track => track.enabled = this.videoEnabled);
		},
		// 复制房间链接
		copyURL() {
			navigator.clipboard.writeText(this.roomLink).then(
				() => {
					this.copyText = "Copied 👍";
					setTimeout(() => (this.copyText = ""), 3000);
				},
				(err) => console.error(err)
			);
		},
		// 切换音频状态
		audioToggle(e) {
			e.stopPropagation();
			localMediaStream.getAudioTracks()[0].enabled = !localMediaStream.getAudioTracks()[0].enabled;
			this.audioEnabled = !this.audioEnabled;
			this.updateUserData("audioEnabled", this.audioEnabled);
		},
		// 切换视频状态
		videoToggle(e) {
			e.stopPropagation();
			this.videoEnabled = !this.videoEnabled;
			this.updateUserData("videoEnabled", this.videoEnabled);

			if (this.videoEnabled) {
				// 用户打开了摄像头，获取摄像头的媒体流  
				navigator.mediaDevices.getUserMedia({ video: true })
					.then((stream) => {
						// 将新的媒体流添加到所有的 RTCPeerConnection 中  
						for (let peer_id in peers) {
							const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === 'video' : false));
							sender.replaceTrack(stream.getVideoTracks()[0]);
						}
						// 更新 localMediaStream  
						localMediaStream = stream;
						// 更新自己的视频标签的媒体流  
						attachMediaStream(document.getElementById('selfVideo'), stream);
					})
					.catch((err) => {
						console.log('Failed to get local stream', err);
					});
			} else {
				// 用户关闭了摄像头，停止所有的视频轨道  
				localMediaStream.getVideoTracks().forEach(track => track.stop());
			}
		},


		// 切换自视频镜像
		toggleSelfVideoMirror() {
			document.querySelector("#videos .video #selfVideo").classList.toggle("mirror");
		},
		// 更新用户名
		updateName() {
			window.localStorage.name = this.name;
		},
		// 更新用户名并发布
		updateNameAndPublish() {
			window.localStorage.name = this.name;
			this.updateUserData("peerName", this.name);
		},
		// 显示通知
		showNotification(message) {
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
		},

		// 切换屏幕共享状态  
		screenShareToggle(e) {
			e.stopPropagation();
			let screenMediaPromise;
			if (!this.screenShareEnabled) {
				if (navigator.getDisplayMedia) {
					screenMediaPromise = navigator.getDisplayMedia({ video: true });
				} else if (navigator.mediaDevices.getDisplayMedia) {
					screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
				} else {
					screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: { mediaSource: "screen" } });
				}
			} else {
				// 停止共享屏幕时，给screenMediaPromise赋值
				screenMediaPromise = Promise.resolve();
			}

			screenMediaPromise
				.then((screenStream) => {
					this.screenShareEnabled = !this.screenShareEnabled;
					let videoTrack;
					if (screenStream) {
						// 用户启动屏幕共享    
						videoTrack = screenStream.getVideoTracks()[0];
						videoTrack.onended = function () {
							if (this.screenShareEnabled) this.screenShareToggle();
						};
						// 隐藏摄像头关闭的图标  
						document.getElementById(this.peerId + "_videoEnabled").style.visibility = 'hidden';
					} else {
						// 用户停止屏幕共享    
						videoTrack = localMediaStream.getVideoTracks()[0];

						// 如果用户已经关闭了摄像头，那么在停止屏幕共享时，仍然显示摄像头关闭的图标  
						if (!this.videoEnabled) {
							document.getElementById(this.peerId + "_videoEnabled").style.visibility = 'visible';
						}
					}
					let tracks = [];
					if (videoTrack) tracks.push(videoTrack);
					if (localMediaStream.getAudioTracks()[0]) tracks.push(localMediaStream.getAudioTracks()[0]);
					const newStream = new MediaStream(tracks);
					localMediaStream = newStream;

					// 添加新的媒体流到所有的 RTCPeerConnection 中  
					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === 'video' : false));
						sender.replaceTrack(newStream.getVideoTracks()[0]);
					}

					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.toggleSelfVideoMirror();

					// 发送消息，控制是否显示摄像头关闭的图标
					this.sendDataMessage("screenShareEnabled", this.screenShareEnabled);
				})
				.catch((e) => {
					this.showNotification("Unable to share screen. Please use a supported browser.");
					console.error(e);
				});
		},
		toggleSpeechRecognition() {
            if (this.audioEnabled) {
                this.startSpeechRecognition(this.selectedLanguage);
            } else {
                this.stopSpeechRecognition();
            }
        },
        startSpeechRecognition(language) {
            // Function to start speech recognition with the selected language
            startSpeechRecognition(language);
        },
        stopSpeechRecognition() {
            // Function to stop speech recognition
            stopSpeechRecognition();
        },
		},

		// 更新用户数据
		updateUserData(key, value) {
			this.sendDataMessage(key, value);

			switch (key) {
				case "audioEnabled":
					document.getElementById(this.peerId + "_audioEnabled").className =
						"audioEnabled icon-mic" + (value ? "" : "-off");
					break;
				case "videoEnabled":
					document.getElementById(this.peerId + "_videoEnabled").style.visibility = value ? "hidden" : "visible";
					break;
				case "peerName":
					document.getElementById(this.peerId + "_videoPeerName").innerHTML = value + " (you)";
					break;
				default:
					break;
			}
		},
		// 更换摄像头
		changeCamera(deviceId) {
			navigator.mediaDevices
				.getUserMedia({ video: { deviceId: deviceId } })
				.then((camStream) => {
					console.log(camStream);

					this.videoEnabled = true;
					this.updateUserData("videoEnabled", this.videoEnabled);

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "video" : false));
						sender.replaceTrack(camStream.getVideoTracks()[0]);
					}
					camStream.getVideoTracks()[0].enabled = true;

					const newStream = new MediaStream([camStream.getVideoTracks()[0], localMediaStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.selectedVideoDeviceId = deviceId;
				})
				.catch((err) => {
					console.log(err);
					this.showNotification("Error while swaping camera");
				});
		},
		// 更换麦克风
		changeMicrophone(deviceId) {
			navigator.mediaDevices
				.getUserMedia({ audio: { deviceId: deviceId } })
				.then((micStream) => {
					this.audioEnabled = true;
					this.updateUserData("audioEnabled", this.audioEnabled);

					for (let peer_id in peers) {
						const sender = peers[peer_id].getSenders().find((s) => (s.track ? s.track.kind === "audio" : false));
						sender.replaceTrack(micStream.getAudioTracks()[0]);
					}
					micStream.getAudioTracks()[0].enabled = true;

					const newStream = new MediaStream([localMediaStream.getVideoTracks()[0], micStream.getAudioTracks()[0]]);
					localMediaStream = newStream;
					attachMediaStream(document.getElementById("selfVideo"), newStream);
					this.selectedAudioDeviceId = deviceId;
				})
				.catch((err) => {
					console.log(err);
					this.showNotification("Error while swaping microphone");
				});
		},
		// 安全化字符串
		sanitizeString(str) {
			const tagsToReplace = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
			const replaceTag = (tag) => tagsToReplace[tag] || tag;
			const safe_tags_replace = (str) => str.replace(/[&<>]/g, replaceTag);
			return safe_tags_replace(str);
		},
		// 将字符串转换为链接
		linkify(str) {
			return this.sanitizeString(str).replace(/(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+\.[\w/\-?=%]+/gi, (match) => {
				let displayURL = match.trim().replace("https://", "").replace("https://", "");
				displayURL = displayURL.length > 25 ? displayURL.substr(0, 25) + "&hellip;" : displayURL;
				const url = !/^https?:\/\//i.test(match) ? "http://" + match : match;
				return `<a href="${url}" target="_blank" class="link" rel="noopener">${displayURL}</a>`;
			});
		},
		// 编辑消息内容
		edit(e) {
			this.typing = e.srcElement.textContent;
		},
		// 粘贴消息内容
		paste(e) {
			e.preventDefault();
			const clipboardData = e.clipboardData || window.clipboardData;
			const pastedText = clipboardData.getData("Text");
			document.execCommand("inserttext", false, pastedText.replace(/(\r\n\t|\n|\r\t)/gm, " "));
		},
		// 发送聊天消息
		sendChat(e) {
			e.stopPropagation();
			e.preventDefault();

			if (!this.typing.length) return;

			if (Object.keys(peers).length > 0) {
				const composeElement = document.getElementById("compose");
				this.sendDataMessage("chat", this.typing);
				this.typing = "";
				composeElement.textContent = "";
				composeElement.blur;
			} else {
				this.showNotification("No peers in the room");
			}
		},
		// 发送数据消息
		sendDataMessage(key, value) {
			const dataMessage = {
				type: key,
				name: this.name,
				id: this.peerId,
				message: value,
				date: new Date().toISOString(),
			};

			switch (key) {
				case "chat":
					this.chats.push(dataMessage);
					this.$nextTick(this.scrollToBottom);
					break;
				default:
					break;
			}

			Object.keys(dataChannels).map((peer_id) => dataChannels[peer_id].send(JSON.stringify(dataMessage)));
		},
		// 处理传入的数据通道消息
		handleIncomingDataChannelMessage(dataMessage) {
			switch (dataMessage.type) {
				case "chat":
					this.showChat = true;
					this.hideToolbar = false;
					this.chats.push(dataMessage);
					this.$nextTick(this.scrollToBottom);
					break;
				case "audioEnabled":
					document.getElementById(dataMessage.id + "_audioEnabled").className =
						"audioEnabled icon-mic" + (dataMessage.message ? "" : "-off");
					break;
				case "videoEnabled":
					document.getElementById(dataMessage.id + "_videoEnabled").style.visibility = dataMessage.message
						? "hidden"
						: "visible";
					break;
				case "peerName":
					document.getElementById(dataMessage.id + "_videoPeerName").innerHTML = dataMessage.message;
					break;
				case "screenShareEnabled":
					const videoEnabledIcon = document.getElementById(dataMessage.id + "_videoEnabled");
					if (dataMessage.message) {
						// 用户开始了屏幕共享，隐藏图标  
						videoEnabledIcon.style.display = 'none';
					} else {
						// 用户停止了屏幕共享，显示图标  
						videoEnabledIcon.style.display = 'block';
					}
				default:
					break;
			}
		},
		// 滚动到聊天底部
		scrollToBottom() {
			const chatContainer = this.$refs.chatContainer;
			chatContainer.scrollTop = chatContainer.scrollHeight;
		},
		// 格式化日期
		formatDate(dateString) {
			const date = new Date(dateString);
			const hours = date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
			return (
				(hours < 10 ? "0" + hours : hours) +
				":" +
				(date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) +
				" " +
				(date.getHours() >= 12 ? "PM" : "AM")
			);
		},
		// 设置样式
		setStyle(key, value) {
			document.documentElement.style.setProperty(key, value);
		},
		// 通话反馈
		onCallFeedback(e) {
			try {
				if (cabin) {
					cabin.event(e.target.getAttribute("data-cabin-event"));
				}
			} catch (e) { }
		},
		// 退出通话
		exit() {
			signalingSocket.close();
			for (let peer_id in peers) {
				peers[peer_id].close();
			}
			this.callEnded = true;
		},
	},
	).mount("#app");

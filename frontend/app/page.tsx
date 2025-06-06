'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
	Container,
	Box,
	Typography,
	Button,
	CircularProgress,
	Paper,
	Stack,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ColorizeIcon from '@mui/icons-material/Colorize';
import HomeIcon from '@mui/icons-material/Home';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import {
	UploadBox,
	HiddenInput,
	PreviewImage,
	MarkdownContainer,
	ColorDisplay,
} from '../styles/App';
import ChatWidget from './chat';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Colors {
	[key: string]: string;
}

interface OutfitImages {
	[key: string]: string;
}

export default function Home() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string>('');
	const [result, setResult] = useState<string>('');
	const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
	const [error, setError] = useState<string>('');
	const [colors, setColors] = useState<Colors | null>(null);
	const [customColors, setCustomColors] = useState<Colors | null>(null);
	const [colorsChanged, setColorsChanged] = useState<boolean>(false);
	const [outfitImage, setOutfitImage] = useState<OutfitImages | null>(null);
	const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
	const [message, setMessage] = useState<string>(
		'Analysis results will be displayed here after uploading or taking a photo',
	);
	const videoRef = useRef<HTMLVideoElement>(null);
	const [userPrompt, setUserPrompt] = useState<string[] | null>(null);

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [textAnalysisDone, setTextAnalysisDone] = useState(true);
	const [imageAnalysisDone, setImageAnalysisDone] = useState(true);

	const router = useRouter();

	const getApiUrl = () => {
		if (
			typeof window !== 'undefined' &&
			window.location.hostname === 'localhost'
		) {
			return 'http://localhost:3001';
		}
		return 'https://api.coloranalysis.fun';
	};

	const ANALYZE_API = getApiUrl();

	// Text Analysis
	useEffect(() => {
		const runTextAnalysis = async () => {
			if (!isAnalyzing || textAnalysisDone || !selectedFile) return;

			const formData = new FormData();
			formData.append('face_image', selectedFile);
			if (customColors) {
				formData.append('colors', JSON.stringify(customColors));
				setCustomColors(null);
				setColorsChanged(false);
			}

			try {
				const response = await fetch(`${ANALYZE_API}/analyze/text`, {
					method: 'POST',
					body: formData,
				});

				if (!response.ok) {
					const errorData = await response
						.json()
						.catch(() => ({ detail: 'Unknown error occurred' }));
					throw new Error(
						errorData.detail ||
							`HTTP error! status: ${response.status}`,
					);
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();
				let accumulatedText = '';
				let pendingText = '';

				if (!reader) {
					throw new Error('No reader available');
				}

				// Function to type out text character by character
				const typeText = async (text: string) => {
					for (let i = 0; i < text.length; i++) {
						pendingText += text[i];
						setResult(accumulatedText + pendingText);
						await new Promise((resolve) => setTimeout(resolve, 5)); // 20ms delay between characters
					}
					accumulatedText += pendingText;
					pendingText = '';
				};

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n');

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							try {
								const data = JSON.parse(line.slice(6));
								if (data.chunk) {
									await typeText(data.chunk);
								}
								if (data.colors) {
									setColors(data.colors);
								}
							} catch (e) {
								console.error('Error parsing SSE data:', e);
							}
						}
					}
				}
				setImageAnalysisDone(false);
			} catch (error) {
				setError(
					error instanceof Error ? error.message : 'Unknown Error',
				);
				setIsAnalyzing(false);
			}
			setTextAnalysisDone(true);
		};

		runTextAnalysis();
	}, [
		isAnalyzing,
		textAnalysisDone,
		selectedFile,
		customColors,
		ANALYZE_API,
	]);

	// Image Analysis
	useEffect(() => {
		const runImageAnalysis = async () => {
			if (!isAnalyzing || imageAnalysisDone || !selectedFile) return;

			const formData = new FormData();
			formData.append('face_image', selectedFile);
			if (userPrompt) {
				console.log(userPrompt);
				formData.append('user_prompt', JSON.stringify(userPrompt));
			}

			try {
				const { data } = await axios.post(
					`${ANALYZE_API}/analyze/image`,
					formData,
				);

				const outfitImages: OutfitImages = {};
				data.images.forEach(
					(item: { style: string; image: string }) => {
						outfitImages[item.style] = item.image;
					},
				);

				// 立即更新狀態和渲染
				setOutfitImage(outfitImages);
				setSelectedStyle(data.images[0].style);
			} catch (error) {
				setError(
					error instanceof Error ? error.message : 'Unknown Error',
				);
				setIsAnalyzing(false);
			}
			setImageAnalysisDone(true);
			setIsAnalyzing(false);
		};

		runImageAnalysis();
	}, [isAnalyzing, imageAnalysisDone, selectedFile, userPrompt, ANALYZE_API]);

	useEffect(() => {
		setResult('');
		setColors(null);
		setCustomColors(null);
		setColorsChanged(false);
		setError('');
		setOutfitImage(null);
		setSelectedStyle(null);
	}, [selectedFile]);

	const startCamera = async (): Promise<void> => {
		try {
			if (
				!navigator.mediaDevices ||
				!navigator.mediaDevices.getUserMedia
			) {
				throw new Error(
					'Your browser does not support camera functionality',
				);
			}
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user' },
			});
			setIsCameraActive(true);

			setTimeout(() => {
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.play();
				}
			}, 100);
		} catch (error) {
			console.error('Unable to open camera:', error);
			setError(
				'Unable to open camera, please confirm camera permissions have been granted',
			);
		}
	};

	const stopCamera = (): void => {
		if (videoRef.current && videoRef.current.srcObject) {
			const tracks = (
				videoRef.current.srcObject as MediaStream
			).getTracks();
			tracks.forEach((track) => track.stop());
		}
		setIsCameraActive(false);
	};

	const takePhoto = (): void => {
		if (videoRef.current) {
			const canvas = document.createElement('canvas');
			canvas.width = videoRef.current.videoWidth;
			canvas.height = videoRef.current.videoHeight;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(videoRef.current, 0, 0);
				const dataUrl = canvas.toDataURL('image/jpeg');
				setPreview(dataUrl);

				fetch(dataUrl)
					.then((res) => res.blob())
					.then((blob) => {
						const file = new File([blob], 'camera-photo.jpg', {
							type: 'image/jpeg',
						});
						setSelectedFile(file);
					});
			}
		}
	};

	const handleFileSelect = (
		event: React.ChangeEvent<HTMLInputElement>,
	): void => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (file && file.type.startsWith('image/')) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setPreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		} else {
			alert('Please upload an image file!');
		}
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
		event.preventDefault();
		const file = event.dataTransfer.files[0];
		if (file && file.type.startsWith('image/')) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setPreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleAnalyze = (): void => {
		if (!selectedFile) {
			setError('Image file not found');
			return;
		}

		setResult('');
		setColors(null);
		setColorsChanged(false);
		setError('');
		setOutfitImage(null);
		setSelectedStyle(null);

		// start analyzing
		setIsAnalyzing(true);
		setTextAnalysisDone(false);
	};

	const handleColorChange = (part: string, newColor: string): void => {
		setCustomColors((prevColors) => {
			const baseColors = prevColors || colors;
			return {
				...baseColors,
				[part]: newColor,
			};
		});
		setColorsChanged(true);
	};

	useEffect(() => {
		if (customColors) {
			setColorsChanged(true);
		}
	}, [customColors]);

	const resetUpload = (): void => {
		if (isCameraActive) {
			if (videoRef.current && videoRef.current.srcObject) {
				const tracks = (
					videoRef.current.srcObject as MediaStream
				).getTracks();
				tracks.forEach((track) => track.stop());
			}
			setIsCameraActive(false);
		}
		setPreview('');
		setSelectedFile(null);
		setResult('');
		setError('');
		setColors(null);
		setCustomColors(null);
		setOutfitImage(null);
	};

	return (
		<Container maxWidth="lg" sx={{ mb: 4 }}>
			<Box sx={{ my: 4, textAlign: 'center' }}>
				<Typography
					variant="h3"
					component="h1"
					color="primary"
					gutterBottom
				>
					Korean Personal Color Analytics
				</Typography>
				<Typography variant="h6" color="text.secondary" paragraph>
					Upload your photo or take a picture, and let AI create
					personalized color recommendations for you
				</Typography>
				<Button
					variant="outlined"
					color="primary"
					size="large"
					startIcon={<HomeIcon sx={{ fontSize: '1.5rem' }} />}
					onClick={() => router.push('/virtual-tryon')}
					sx={{
						textTransform: 'none',
						mb: 3,
						fontSize: '1.2rem',
						px: 4,
						py: 1.5,
						boxShadow: 3,
						'&:hover': {
							transform: 'translateY(-2px)',
							boxShadow: 6,
							backgroundColor: 'secondary',
						},
						transition: 'all 0.2s ease-in-out',
					}}
				>
					Enter Virtual Fitting Room
				</Button>
			</Box>

			<Box
				sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}
			>
				<Box>
					<UploadBox
						onDrop={handleDrop}
						onDragOver={(e: React.DragEvent<HTMLDivElement>) =>
							e.preventDefault()
						}
						onClick={() =>
							!isCameraActive &&
							document.getElementById('file-input')?.click()
						}
					>
						{preview ? (
							<PreviewImage src={preview} alt="Preview" />
						) : (
							<>
								{isCameraActive && (
									<Box
										sx={{
											width: '100%',
											display: 'flex',
											justifyContent: 'center',
											mb: 2,
										}}
									>
										<video
											ref={videoRef}
											style={{
												maxWidth: '100%',
												height: 'auto',
												borderRadius: '8px',
											}}
										/>
									</Box>
								)}
								{!isCameraActive && (
									<>
										<CloudUploadIcon
											sx={{
												fontSize: 60,
												color: '#f8b195',
												mb: 2,
											}}
										/>
										<Typography>
											Click or drag photos here
										</Typography>
									</>
								)}
							</>
						)}
						<HiddenInput
							id="file-input"
							type="file"
							accept="image/*"
							onChange={handleFileSelect}
						/>
					</UploadBox>

					<Stack direction="row" spacing={2} sx={{ mt: 2 }}>
						{preview && (
							<Button
								variant="outlined"
								fullWidth
								onClick={resetUpload}
								sx={{ textTransform: 'none' }}
							>
								Reset Upload
							</Button>
						)}
						{!isCameraActive ? (
							<Button
								variant="contained"
								fullWidth
								startIcon={<CameraAltIcon />}
								onClick={startCamera}
								sx={{ textTransform: 'none' }}
							>
								Open Camera
							</Button>
						) : (
							!preview && (
								<>
									<Button
										variant="contained"
										fullWidth
										color="secondary"
										onClick={takePhoto}
										sx={{ textTransform: 'none' }}
									>
										Take Photo
									</Button>
									<Button
										variant="outlined"
										fullWidth
										color="error"
										onClick={stopCamera}
										sx={{ textTransform: 'none' }}
									>
										Close Camera
									</Button>
								</>
							)
						)}
						<Button
							variant="contained"
							fullWidth
							disabled={!selectedFile || isAnalyzing}
							onClick={handleAnalyze}
							sx={{ textTransform: 'none' }}
						>
							Start Analysis
						</Button>
					</Stack>
					{isAnalyzing ? (
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								mt: 8,
							}}
						>
							<CircularProgress />
							<Typography sx={{ mt: 2 }}>
								Analyzing, please wait...
							</Typography>
						</Box>
					) : (
						outfitImage &&
						selectedStyle && (
							<Box sx={{ mt: 4, textAlign: 'center' }}>
								<Typography variant="h6" gutterBottom>
									Recommended Outfit
								</Typography>
								<Box
									sx={{
										mb: 2,
										display: 'flex',
										gap: 1,
										flexWrap: 'wrap',
										justifyContent: 'center',
									}}
								>
									{Object.keys(outfitImage).map((style) => (
										<Button
											key={style}
											variant={
												selectedStyle === style
													? 'contained'
													: 'outlined'
											}
											onClick={() =>
												setSelectedStyle(style)
											}
											sx={{ textTransform: 'none' }}
										>
											{style}
										</Button>
									))}
								</Box>
								<Paper
									elevation={3}
									sx={{
										p: 2,
										display: 'inline-block',
										maxWidth: '100%',
										borderRadius: 2,
									}}
								>
									<Image
										src={`data:image/png;base64,${outfitImage[selectedStyle]}`}
										alt={`${selectedStyle} Outfit`}
										width={500}
										height={500}
										style={{
											maxWidth: '100%',
											height: 'auto',
											borderRadius: '8px',
											cursor: 'pointer',
										}}
										onClick={() => {
											const overlay =
												document.createElement('div');
											overlay.style.position = 'fixed';
											overlay.style.top = '0';
											overlay.style.left = '0';
											overlay.style.width = '100vw';
											overlay.style.height = '100vh';
											overlay.style.backgroundColor =
												'rgba(0, 0, 0, 0.8)';
											overlay.style.display = 'flex';
											overlay.style.justifyContent =
												'center';
											overlay.style.alignItems = 'center';
											overlay.style.zIndex = '1000';

											const fullScreenImage =
												document.createElement('img');
											fullScreenImage.src = `data:image/png;base64,${outfitImage[selectedStyle]}`;
											fullScreenImage.style.maxWidth =
												'100%';
											fullScreenImage.style.maxHeight =
												'auto';
											fullScreenImage.style.objectFit =
												'contain';
											fullScreenImage.style.borderRadius =
												'8px';

											const closeButton =
												document.createElement(
													'button',
												);
											closeButton.innerText = '×';
											closeButton.style.position =
												'absolute';
											closeButton.style.top = '20px';
											closeButton.style.right = '20px';
											closeButton.style.backgroundColor =
												'transparent';
											closeButton.style.color = 'white';
											closeButton.style.border = 'none';
											closeButton.style.fontSize = '2rem';
											closeButton.style.cursor =
												'pointer';

											const closeOverlay = () => {
												document.body.removeChild(
													overlay,
												);
											};

											closeButton.onclick = closeOverlay;
											overlay.onclick = (e) => {
												if (e.target === overlay) {
													closeOverlay();
												}
											};

											overlay.appendChild(
												fullScreenImage,
											);
											overlay.appendChild(closeButton);
											document.body.appendChild(overlay);
										}}
									/>
								</Paper>
							</Box>
						)
					)}
				</Box>

				<Paper sx={{ p: 3, height: '100%' }}>
					{error ? (
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								mt: 8,
								color: 'error.main',
							}}
						>
							<Typography variant="h6" gutterBottom>
								Error提示
							</Typography>
							<Typography>{error}</Typography>
						</Box>
					) : result ? (
						<>
							{colors && (
								<Box
									sx={{
										mb: 3,
										p: 2,
										bgcolor: 'grey.50',
										borderRadius: 1,
									}}
								>
									<Typography variant="h6" gutterBottom>
										Detected Colors:
									</Typography>
									{['hair', 'skin', 'lips'].map((part) => (
										<ColorDisplay key={part}>
											<Box
												className="color-box"
												sx={{
													bgcolor: (customColors ||
														colors)[part],
												}}
											>
												<Button
													className="color-picker-button"
													size="small"
													onClick={() => {
														const input =
															document.createElement(
																'input',
															);
														input.type = 'color';
														input.value =
															(customColors ||
																colors)[part];

														input.oninput = (e) => {
															handleColorChange(
																part,
																(
																	e.target as HTMLInputElement
																).value,
															);
														};

														input.addEventListener(
															'change',
															(e) => {
																e.preventDefault();
																e.stopPropagation();
															},
														);

														input.click();
													}}
												>
													<ColorizeIcon fontSize="small" />
												</Button>
											</Box>
											<Typography>
												{part}：
												{(customColors || colors)[part]}
											</Typography>
										</ColorDisplay>
									))}
									{colorsChanged && (
										<Button
											variant="contained"
											fullWidth
											onClick={handleAnalyze}
											sx={{
												mt: 2,
												textTransform: 'none',
											}}
										>
											Reanalyze
										</Button>
									)}
								</Box>
							)}
							<MarkdownContainer>
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{result}
								</ReactMarkdown>
							</MarkdownContainer>
						</>
					) : (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								height: '100%',
							}}
						>
							<Typography color="text.secondary">
								{message}
							</Typography>
						</Box>
					)}
				</Paper>
				<ChatWidget
					setError={setError}
					setOutfitImage={setOutfitImage}
					selectedFile={selectedFile}
					setResultMessage={setMessage}
					setSelectedStyle={setSelectedStyle}
					setIsAnalyzing={setIsAnalyzing}
					setImageAnalysisDone={setImageAnalysisDone}
					setUserPrompt={setUserPrompt}
					isAnalyzing={isAnalyzing}
					error={error}
				/>
			</Box>
		</Container>
	);
}

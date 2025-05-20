document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const uploadBox = document.getElementById('uploadBox');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorContainer = document.getElementById('errorContainer');
    const closeResults = document.getElementById('closeResults');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    const uploadedImagePreview = document.getElementById('uploadedImagePreview');
    const matchedImagePreview = document.getElementById('matchedImagePreview');
    const confidenceMeter = document.getElementById('confidenceMeter');
    const confidenceValue = document.getElementById('confidenceValue');
    const matchedFileName = document.getElementById('matchedFileName');
    const matchScoreText = document.getElementById('matchScoreText');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.querySelector('.nav-links');
    const loadingScreen = document.getElementById('loadingScreen');

    // Initialize floating card animations
    initFloatingCards();

    // Drag and Drop functionality
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Close results
    closeResults.addEventListener('click', () => {
        hideResults();
    });

    // Try again button
    tryAgainBtn.addEventListener('click', () => {
        errorContainer.classList.add('hidden')
        errorContainer.classList.remove('show');
        fileInput.value = '';
    });

    // Mobile menu toggle
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        hamburger.innerHTML = navLinks.classList.contains('active') ? 
            '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                hamburger.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            document.querySelector('.navbar').classList.add('scrolled');
        } else {
            document.querySelector('.navbar').classList.remove('scrolled');
        }
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (this.getAttribute('href') === '#') return;
            
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    hamburger.innerHTML = '<i class="fas fa-bars"></i>';
                }
            }
        });
    });

    // Initialize animations
    initAnimations();

    // Handle file upload
    function handleFileUpload(file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            showError('Invalid File Type', 'Please upload an image file (JPEG, PNG, etc.)');
            return;
        }

        // Show loading screen
        showLoading();

        // Preview uploaded image
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImagePreview.innerHTML = `<img src="${e.target.result}" alt="Uploaded image">`;
        };
        reader.readAsDataURL(file);

        // Create FormData and send to server
        const formData = new FormData();
        formData.append('file', file);

        // Send to server
        fetch('/verify/', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            hideLoading();
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showError('Face Detection Failed', data.error);
            } else if (data.message === "No match found.") {
                showNoMatch();
            } else {
                showResults(data);
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error:', error);
            showError(
                'Processing Error', 
                error.error || error.message || 'An error occurred while processing your image. Please try again.'
            );
        });
    }

    // Show results
    function showResults(data) {
        // Update UI with matched image
        if (data.matched_image_url) {
            matchedImagePreview.innerHTML = `<img src="${data.matched_image_url}" alt="Matched image">`;
        } else {
            matchedImagePreview.innerHTML = '<div class="no-image"><i class="fas fa-user-slash"></i><p>No image available</p></div>';
        }

        // Update match details
        matchedFileName.textContent = data.matched_file ? 
            data.matched_file.replace(/\.[^/.]+$/, "") : 'Unknown';
        
        // Calculate similarity percentage (assuming distance is between 0 and 1 where 0 is perfect match)
        const similarityScore = data.similarity_score !== undefined ? 
            Math.round((1 - data.similarity_score) * 100) : 0;
        
        // Animate the confidence meter
        animateConfidenceMeter(similarityScore);
        matchScoreText.textContent = `Similarity: ${similarityScore}%`;

        // Show results container
        errorContainer.classList.remove('show');
        errorContainer.classList.add('hidden')
        resultsContainer.classList.remove('hidden');
        resultsContainer.classList.add('show');
        
        // Scroll to results
        setTimeout(() => {
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }

    // Show no match found
    function showNoMatch() {
        matchedImagePreview.innerHTML = '<div class="no-image"><i class="fas fa-user-slash"></i><p>No match found</p></div>';
        matchedFileName.textContent = 'No match';
        animateConfidenceMeter(0);
        matchScoreText.textContent = 'Similarity: 0%';
        
        errorContainer.classList.remove('show');
        errorContainer.classList.add('hidden')
        resultsContainer.classList.remove('hidden');
        resultsContainer.classList.add('show');
        
        setTimeout(() => {
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }

    // Show error message
    function showError(title, message) {
        document.getElementById('errorTitle').textContent = title;
        document.getElementById('errorMessage').textContent = message;
        
        resultsContainer.classList.remove('show');
        resultsContainer.classList.add('hidden')
        errorContainer.classList.remove('hidden')
        errorContainer.classList.add('show');
        
        setTimeout(() => {
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }

    // Hide results
    function hideResults() {
        resultsContainer.classList.remove('show');
        resultsContainer.classList.add('hidden');
    }

    // Show loading screen
    function showLoading() {
        loadingScreen.classList.add('active');
    }

    // Hide loading screen
    function hideLoading() {
        loadingScreen.classList.remove('active');
    }

    // Animate confidence meter
    function animateConfidenceMeter(targetPercentage) {
        let currentPercentage = 0;
        const duration = 1000; // Animation duration in ms
        const increment = targetPercentage / (duration / 16); // Roughly 60fps
        
        const animate = () => {
            if (currentPercentage < targetPercentage) {
                currentPercentage += increment;
                if (currentPercentage > targetPercentage) currentPercentage = targetPercentage;
                
                confidenceMeter.style.width = `${currentPercentage}%`;
                confidenceValue.textContent = `${Math.round(currentPercentage)}%`;
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    // Initialize floating cards animation
    function initFloatingCards() {
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, index) => {
            // Set unique rotation for each card
            const rotation = index === 0 ? -5 : index === 1 ? 3 : -2;
            card.style.setProperty('--rotation', `${rotation}deg`);
        });
    }

    // Initialize scroll animations
    function initAnimations() {
        const animateOnScroll = () => {
            const elements = document.querySelectorAll('.feature-card, .step');
            
            elements.forEach(element => {
                const elementPosition = element.getBoundingClientRect().top;
                const screenPosition = window.innerHeight / 1.2;
                
                if (elementPosition < screenPosition) {
                    element.classList.add('animated');
                }
            });
        };
        
        window.addEventListener('scroll', animateOnScroll);
        animateOnScroll(); // Run once on load
    }
});

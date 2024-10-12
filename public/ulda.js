class ulda {
    settings = {
        host:'http://localhost:5555',
    }

    constructor() {
        this.connection = {
            status: false,
        };
        
        this.socket = io.connect(this.settings.host);

        this.socket.on('connect', () => {
            this.connection.status = true;
            console.log('Connection status:', this.connection.status);
        });

        this.socket.on('disconnect', () => {
            this.connection.status = false;
            console.log('Connection status:', this.connection.status);
        });
    }
    
    // The pulse method is called with a callback function that handles the response.
    // This callback logs the latency if it's less than 5 seconds, or logs 'null' if it exceeds that time.
    pulse(callback) {
        const startTime = Date.now();
        this.socket.emit('ping');

        this.socket.once('pong', (serverTime) => {
            const latency = Date.now() - startTime;
            if (latency > 5000) {
                callback(null); // Return null if the response time exceeds 5 seconds
            } else {
                callback(latency); // Otherwise, return the latency in milliseconds
            }
        });
    }

    async MainFileRegister(password, callback) {
        try {
            const File = {
                fun: {}, // Functional side
                content: {}
            };

            File.fun = await this.MainFileMethods.SignCreate(10);
            const linkedHashes = await this.MainFileMethods.SignGenerator(File.fun);
            const encryptedFile = await this.MainFileMethods.FileEncr(File, password);
            //console.log('Generated signatures:', File.fun);
            //console.log('First Hash line)):', linkedHashes);
            console.log('Encrypted file:', encryptedFile);
            if(!this.connection.status){
                //TODO Change later
                alert("Server is down, what are you doing?");
                callback({ status: 'error', error: {message:"AAAAAAAAAAAAA"} });
            }

            this.socket.emit('CanIRegister', {}, (response) => {
                if (response === true) {
                    console.log("Server is up and ready to regiter you");
                    this.socket.emit('RegisterFile', { encryptedFile: encryptedFile }, (serverResponse) => {
                        if (serverResponse.code) {
                            callback({ status: 'success', code: serverResponse.code, file: File });
                        } else {
                            callback({ status: 'error', error: 'Failed to register file' });
                        }
                    });
                } else {
                    console.log('Registration denied by server.');
                    callback({ status: 'error', error: 'Registration denied by server' });
                }
            });
    
        } catch (error) {
            console.error('Error in SignCreate:', error);
            callback({ status: 'error', error: error });
        }
    }

    MainFileMethods = {
        SignCreate: async (number) => {
            const signatures = {};
            for (let i = 0; i < number; i++) {
                const identifier = i; 
                const randomBytes = new Uint8Array(32);
                window.crypto.getRandomValues(randomBytes);
                const base64String = btoa(String.fromCharCode(...randomBytes)).slice(0, 42); 
                signatures[identifier] = base64String;
            }
            return signatures;
        },
        // SignGenerator creates a linked chain of hashes from initial signatures, 
        // incrementing hash iterations for each subsequent signature to enhance security.
        SignGenerator: async (signatures) => {
            const linkedHashes = {};
            let previousHash = '';
            for (let i = 0; i < 5; i++) {  
                let currentHash = signatures[i];
                for (let j = 0; j <= i; j++) {
                    const data = new TextEncoder().encode(previousHash + currentHash);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                    currentHash = Array.from(new Uint8Array(hashBuffer))
                                        .map(b => b.toString(16).padStart(2, '0'))
                                        .join('');
                }
                linkedHashes[i] = currentHash;
                previousHash = currentHash;
            }
            return linkedHashes;
        },
/**
 * Encrypts the file content using AES-GCM with a derived key from the provided password.
 * Returns a Uint8Array combining the salt, IV, and encrypted data.
 * The salt is used for key derivation and the IV is needed for decryption.
 * This method provides a compact byte array format for storage or transmission.
 */
        FileEncr: async (File, password) => {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(File));
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                encoder.encode(password),
                { name: "PBKDF2" },
                false,
                ["deriveKey"]
            );
            const key = await crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                data
            );

            const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
        
            return combined;
        }
    }

}




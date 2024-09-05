import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Container, Row, Col, Button, Form, Card, Pagination, InputGroup, Badge, Tabs, Tab, Tooltip, OverlayTrigger, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import NFTradeABI from './NFTradeABI.json';
import './Pokeball.css';
import NFTBadge from './NFTBadge';
import ReceivedOffers from './components/ReceivedOffers';
import MadeOffers from './components/MadeOffers';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPowerOff, faSun, faMoon } from '@fortawesome/free-solid-svg-icons';

const ERC721ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function approve(address operator, uint256 tokenId) public",
  "function getApproved(uint256 tokenId) public view returns (address)"
];

const USDCABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address operator, uint256 tokenId) public"
];

const USDC_CONTRACT_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [offeree, setOfferee] = useState('');
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [offereeNFTs, setOffereeNFTs] = useState([]);
  const [selectedOfferedNFTs, setSelectedOfferedNFTs] = useState([]);
  const [selectedRequestedNFTs, setSelectedRequestedNFTs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [nftsPerPage] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('makeOffer');
  const [nftError, setNftError] = useState(null);
  const [offeredUSDC, setOfferedUSDC] = useState('0');
  const [requestedUSDC, setRequestedUSDC] = useState('0');
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize darkMode from localStorage, defaulting to false if not set
    return localStorage.getItem('darkMode') === 'true';
  });
  const [activeNFTTab, setActiveNFTTab] = useState('yourNFTs');
  const [nftContract, setNftContract] = useState(null);
  const [usdcContract, setUsdcContract] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          setIsConnecting(true);
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);

          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const currentAccount = accounts[0];
            setAccount(currentAccount);
            setIsWalletConnected(true);
            console.log("Wallet already connected:", currentAccount);
            
            // Setup contract after confirming connection
            const signer = await provider.getSigner();
            await setupContract(signer);
          }

          // Listen for account changes
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', handleChainChanged);
        } catch (error) {
          console.error("Error checking wallet connection:", error);
          toast.error("Failed to check wallet connection. Please try connecting manually.");
        } finally {
          setIsConnecting(false);
          setIsInitialized(true);
        }
      } else {
        console.log("Ethereum object not found, do you have MetaMask installed?");
        setIsInitialized(true);
      }
    };

    checkWalletConnection();

    // Cleanup function
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const setupContract = async (signer) => {
    try {
      const contractAddress = "0x5DbAFD4C585478BB55604FC78662263b266F71f0";
      const nfTradeContract = new ethers.Contract(contractAddress, NFTradeABI, signer);
      setContract(nfTradeContract);
      console.log("Contract set up successfully");
    } catch (error) {
      console.error("Error setting up contract:", error);
      toast.error("Failed to set up the contract. Please try reconnecting your wallet.");
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      const newAccount = accounts[0];
      console.log("Account changed:", newAccount);
      setAccount(newAccount);
      setIsWalletConnected(true);
      
      if (provider) {
        try {
          const signer = await provider.getSigner();
          await setupContract(signer);
        } catch (error) {
          console.error("Error getting signer in handleAccountsChanged:", error);
          toast.error("Failed to update signer. Please try reconnecting your wallet.");
        }
      }
    } else {
      // User disconnected all accounts
      disconnectWallet();
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (provider) {
      const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDCABI, provider);
      setUsdcContract(usdcContract);
    }
  }, [provider]);

  const fetchOwnedNFTs = useCallback(async () => {
    if (!account || !provider) return;
    setIsLoading(true);
    setNftError(null);
    try {
      console.log("fetchOwnedNFTs called");
      console.log("Account:", account);
      console.log("Provider:", provider);

      const nftContractAddress = "0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD";
      const nftContract = new ethers.Contract(nftContractAddress, ERC721ABI, provider);
      setNftContract(nftContract);

      console.log("Fetching NFT balance for account:", account);
      const balance = await nftContract.balanceOf(account);
      console.log("NFT balance:", balance.toString());

      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(account, i);
        console.log("Token ID:", tokenId.toString());
        tokenIds.push(tokenId.toString());
      }

      const nftData = await Promise.all(tokenIds.map(async (id) => {
        console.log("Fetching metadata for token ID:", id);
        const uri = await nftContract.tokenURI(id);
        console.log("Token URI:", uri);
        try {
          const metadata = await fetch(uri).then(res => res.json());
          console.log("Metadata:", metadata);
          return { id, metadata };
        } catch (error) {
          console.error("Error fetching metadata for token ID:", id, error);
          return { id, metadata: { name: `Error: ${error.message}`, image: '' } };
        }
      }));

      console.log("Final NFT data:", nftData);
      setOwnedNFTs(nftData);
    } catch (error) {
      console.error("Error fetching owned NFTs:", error);
      setNftError("Failed to fetch owned NFTs. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [account, provider]);

  const fetchOffereeNFTs = useCallback(async () => {
    if (!provider || !offeree) return;
    setIsLoading(true);
    try {
      const nftContractAddress = "0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD";
      const nftContract = new ethers.Contract(nftContractAddress, ERC721ABI, provider);

      const balance = await nftContract.balanceOf(offeree);
      const tokenIds = [];
      for (let i = 0; i < balance; i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(offeree, i);
        tokenIds.push(tokenId.toString());
      }

      const nftData = await Promise.all(tokenIds.map(async (id) => {
        const uri = await nftContract.tokenURI(id);
        const metadata = await fetch(uri).then(res => res.json());
        return { id, metadata };
      }));

      setOffereeNFTs(nftData);
    } catch (error) {
      console.error("Error fetching offeree's NFTs:", error);
      setNftError("Failed to fetch offeree's NFTs. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [provider, offeree]);

  useEffect(() => {
    if (account && provider) {
      fetchOwnedNFTs();
    }
  }, [account, provider, fetchOwnedNFTs]);

  useEffect(() => {
    if (offeree) {
      fetchOffereeNFTs();
    }
  }, [offeree, fetchOffereeNFTs]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsConnecting(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          await handleAccountsChanged(accounts);
        }
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        toast.error("Failed to connect wallet. Check console for details.");
      } finally {
        setIsConnecting(false);
      }
    } else {
      toast.error("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setOwnedNFTs([]);
    setIsWalletConnected(false);
    console.log("Wallet disconnected");
  };

  const toggleNFTSelection = (nft, isOffered) => {
    const setSelectedNFTs = isOffered ? setSelectedOfferedNFTs : setSelectedRequestedNFTs;
    setSelectedNFTs(prevSelected => {
      if (prevSelected.some(selected => selected.id === nft.id)) {
        return prevSelected.filter(selected => selected.id !== nft.id);
      } else {
        return [...prevSelected, nft];
      }
    });
  };

  // Filter NFTs based on search term and active tab
  const filteredNFTs = (activeNFTTab === 'yourNFTs' ? ownedNFTs : offereeNFTs).filter(nft => 
    nft.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current NFTs
  const indexOfLastNFT = currentPage * nftsPerPage;
  const indexOfFirstNFT = indexOfLastNFT - nftsPerPage;
  const currentNFTs = filteredNFTs.slice(indexOfFirstNFT, indexOfLastNFT);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page when search term changes
  };

  const makeOffer = async () => {
    if (!contract || !nftContract || !usdcContract || !account) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!offeree) {
      toast.error("Please enter the offeree's address.");
      return;
    }
    if (selectedOfferedNFTs.length === 0 && selectedRequestedNFTs.length === 0 && offeredUSDC === '0' && requestedUSDC === '0') {
      toast.error("Please select at least one NFT or enter an amount of USDC to offer or request.");
      return;
    }

    // Verify signer
    try {
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== account.toLowerCase()) {
        console.error("Signer mismatch. Reconnecting wallet...");
        await connectWallet();
        return;
      }
    } catch (error) {
      console.error("Error verifying signer:", error);
      toast.error("Failed to verify wallet connection. Please try reconnecting your wallet.");
      return;
    }

    let toastId;
    try {
      toastId = toast.loading('Preparing to make offer...', { autoClose: false });

      // Get the signer
      const signer = await provider.getSigner(account);
      const nftContractWithSigner = nftContract.connect(signer);
      const usdcContractWithSigner = usdcContract.connect(signer);

      // Approve each offered NFT
      for (const nft of selectedOfferedNFTs) {
        const nftName = nft.metadata?.name || `NFT #${nft.id}`;
        const confirmApproval = await new Promise(resolve => {
          toast.update(toastId, { 
            render: (
              <div>
                <p>Approval needed for NFT: {nftName}</p>
                <p>This approval allows the NFTrade contract to transfer this NFT when your offer is accepted.</p>
                <p>Do you want to proceed with the approval?</p>
                <Button onClick={() => resolve(true)} variant="success" size="sm" className="me-2">Yes, Approve</Button>
                <Button onClick={() => resolve(false)} variant="danger" size="sm">Cancel</Button>
              </div>
            ),
            type: "info",
            isLoading: false,
            closeOnClick: false,
            closeButton: false,
            autoClose: false,
          });
        });

        if (!confirmApproval) {
          toast.update(toastId, { 
            render: "Offer creation cancelled",
            type: "info",
            isLoading: false,
            autoClose: 3000,
          });
          return;
        }

        toast.update(toastId, { 
          render: `Approving NFT: ${nftName}...`, 
          type: "info", 
          isLoading: true 
        });

        const approvalTx = await nftContractWithSigner.approve(contract.target, nft.id);
        await approvalTx.wait();
      }

      // Approve USDC
      if (offeredUSDC !== '0') {
        const confirmUSDCApproval = await new Promise(resolve => {
          toast.update(toastId, { 
            render: (
              <div>
                <p>Approval needed for {offeredUSDC} USDC</p>
                <p>This approval allows the NFTrade contract to transfer USDC when your offer is accepted.</p>
                <p>Do you want to proceed with the approval?</p>
                <Button onClick={() => resolve(true)} variant="success" size="sm" className="me-2">Yes, Approve</Button>
                <Button onClick={() => resolve(false)} variant="danger" size="sm">Cancel</Button>
              </div>
            ),
            type: "info",
            isLoading: false,
            closeOnClick: false,
            closeButton: false,
            autoClose: false,
          });
        });

        if (!confirmUSDCApproval) {
          toast.update(toastId, { 
            render: "Offer creation cancelled",
            type: "info",
            isLoading: false,
            autoClose: 3000,
          });
          return;
        }

        toast.update(toastId, { 
          render: `Approving ${offeredUSDC} USDC...`, 
          type: "info", 
          isLoading: true 
        });

        const offeredAmount = ethers.parseUnits(offeredUSDC, 6);
        const usdcApprovalTx = await usdcContractWithSigner.approve(contract.target, offeredAmount);
        await usdcApprovalTx.wait();
      }

      toast.update(toastId, { 
        render: "Sending offer transaction...", 
        type: "info", 
        isLoading: true 
      });

      const tx = await contract.makeOffer(
        selectedOfferedNFTs.map(nft => nft.id),
        ethers.parseUnits(offeredUSDC, 6),
        selectedRequestedNFTs.map(nft => nft.id),
        ethers.parseUnits(requestedUSDC, 6),
        offeree
      );

      const polygonscanUrl = `https://polygonscan.com/tx/${tx.hash}`;

      toast.update(toastId, { 
        render: "Offer transaction sent. Waiting for confirmation...", 
        type: "info", 
        isLoading: true 
      });

      const receipt = await tx.wait();
      
      toast.update(toastId, { 
        render: (
          <div>
            Offer transaction successful!
            <br />
            <a href={polygonscanUrl} target="_blank" rel="noopener noreferrer">
              View on PolygonScan
            </a>
          </div>
        ), 
        type: "success",
        isLoading: false,
        autoClose: 5000
      });

      console.log("PolygonScan URL:", polygonscanUrl);

      setSelectedOfferedNFTs([]);
      setSelectedRequestedNFTs([]);
      setOfferedUSDC('0');
      setRequestedUSDC('0');
    } catch (error) {
      console.error('Error making offer:', error);
      toast.update(toastId, { 
        render: (
          <div>
            Error making offer: {error.message}
            <br />
            Check console for details.
          </div>
        ),
        type: "error",
        isLoading: false,
        autoClose: 5000
      });
    }
  };

  useEffect(() => {
    // Update localStorage when darkMode changes
    localStorage.setItem('darkMode', darkMode);
    // Apply or remove dark mode class on body
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Function to toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  const renderMakeOfferTab = () => (
    <>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">NFTs</h2>
          <Tabs
            activeKey={activeNFTTab}
            onSelect={(k) => setActiveNFTTab(k)}
            className="mb-3"
          >
            <Tab eventKey="yourNFTs" title="Your NFTs">
              {renderNFTList(ownedNFTs, true)}
            </Tab>
            <Tab eventKey="offereeNFTs" title="Offeree's NFTs">
              {renderNFTList(offereeNFTs, false)}
            </Tab>
          </Tabs>
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">Make Offer</h2>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Step 2:</strong> Select NFTs to Offer</Form.Label>
                  <p className="text-muted">
                    Click on your NFTs in the "Your NFTs" tab above to select them for the offer.
                  </p>
                  <div className="border rounded p-2" style={{minHeight: '100px', maxHeight: '200px', overflowY: 'auto'}}>
                    {selectedOfferedNFTs.length === 0 ? (
                      <p className="text-muted mb-0">No NFTs selected yet</p>
                    ) : (
                      <div className="d-flex flex-wrap">
                        {selectedOfferedNFTs.map(nft => (
                          <NFTBadge
                            key={nft.id}
                            nft={nft}
                            onClick={() => toggleNFTSelection(nft, true)}
                            bg="primary"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>USDC to Offer</Form.Label>
                  <InputGroup>
                    <Form.Control 
                      type="number" 
                      value={offeredUSDC} 
                      onChange={(e) => setOfferedUSDC(e.target.value)}
                      placeholder="Amount of USDC to offer"
                    />
                    <InputGroup.Text>USDC</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Step 3:</strong> Select NFTs to Request</Form.Label>
                  <p className="text-muted">
                    Click on the offeree's NFTs in the "Offeree's NFTs" tab above to select them for your request.
                  </p>
                  <div className="border rounded p-2" style={{minHeight: '100px', maxHeight: '200px', overflowY: 'auto'}}>
                    {selectedRequestedNFTs.length === 0 ? (
                      <p className="text-muted mb-0">No NFTs selected yet</p>
                    ) : (
                      <div className="d-flex flex-wrap">
                        {selectedRequestedNFTs.map(nft => (
                          <NFTBadge
                            key={nft.id}
                            nft={nft}
                            onClick={() => toggleNFTSelection(nft, false)}
                            bg="success"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>USDC to Request</Form.Label>
                  <InputGroup>
                    <Form.Control 
                      type="number" 
                      value={requestedUSDC} 
                      onChange={(e) => setRequestedUSDC(e.target.value)}
                      placeholder="Amount of USDC to request"
                    />
                    <InputGroup.Text>USDC</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
              </Col>
            </Row>

            <Row className="mt-4">
              <Col>
                <Card className={`mb-3 ${darkMode ? 'text-white' : ''}`}>
                  <Card.Header as="h5">Offer Summary</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6} className="border-end">
                        <h6 className="text-primary">You are offering:</h6>
                        <Card bg="light" className={`mb-3 ${darkMode ? 'text-white bg-dark' : ''}`}>
                          <Card.Body>
                            <h6>NFTs:</h6>
                            {selectedOfferedNFTs.length === 0 ? (
                              <p className="text-muted">No NFTs selected</p>
                            ) : (
                              <ul className="list-unstyled">
                                {selectedOfferedNFTs.map(nft => (
                                  <li key={nft.id}>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-offer-${nft.id}`}>
                                          <img 
                                            src={nft.metadata.image} 
                                            alt={nft.metadata.name} 
                                            style={{ maxWidth: '150px', maxHeight: '150px' }} 
                                          />
                                        </Tooltip>
                                      }
                                    >
                                      <span className="text-primary">• {nft.metadata.name}</span>
                                    </OverlayTrigger>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <h6 className="mt-3">USDC:</h6>
                            <p>{offeredUSDC === '0' ? 'None' : `${offeredUSDC} USDC`}</p>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={6}>
                        <h6 className="text-success">You are requesting:</h6>
                        <Card bg="light" className={`mb-3 ${darkMode ? 'text-white bg-dark' : ''}`}>
                          <Card.Body>
                            <h6>NFTs:</h6>
                            {selectedRequestedNFTs.length === 0 ? (
                              <p className="text-muted">No NFTs selected</p>
                            ) : (
                              <ul className="list-unstyled">
                                {selectedRequestedNFTs.map(nft => (
                                  <li key={nft.id}>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-request-${nft.id}`}>
                                          <img 
                                            src={nft.metadata.image} 
                                            alt={nft.metadata.name} 
                                            style={{ maxWidth: '150px', maxHeight: '150px' }} 
                                          />
                                        </Tooltip>
                                      }
                                    >
                                      <span className="text-success">• {nft.metadata.name}</span>
                                    </OverlayTrigger>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <h6 className="mt-3">USDC:</h6>
                            <p>{requestedUSDC === '0' ? 'None' : `${requestedUSDC} USDC`}</p>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Button variant="primary" onClick={makeOffer} className="mt-3">
              Make Offer
            </Button>
          </Form>
        </Col>
      </Row>
    </>
  );

  const renderNFTList = (nfts, isOffered) => (
    <>
      {!isOffered && (
        <Form.Group className="mb-3">
          <Form.Label>Offeree's Address</Form.Label>
          <Form.Control 
            type="text" 
            value={offeree} 
            onChange={(e) => setOfferee(e.target.value)}
            placeholder="Enter the address of the person you want to trade with"
          />
        </Form.Group>
      )}
      <InputGroup className="mb-3">
        <Form.Control
          placeholder="Search NFTs by name"
          value={searchTerm}
          onChange={handleSearchChange}
          className={darkMode ? 'bg-dark text-white' : ''}
        />
        <Button variant={darkMode ? "outline-light" : "outline-secondary"} onClick={() => setSearchTerm('')}>
          Clear
        </Button>
      </InputGroup>
      {nftError && <Alert variant="danger">{nftError}</Alert>}
      {isLoading ? (
        <div className="pokeball-container">
          <div className="pokeball">
            <div className="pokeball__button"></div>
          </div>
        </div>
      ) : (
        <>
          {filteredNFTs.length === 0 && !nftError && <p>No NFTs found matching your search.</p>}
          <Row xs={2} sm={3} md={4} lg={5} className="g-4">
            {currentNFTs.map((nft) => (
              <Col key={nft.id}>
                <Card 
                  style={{ width: '100%', height: '100%', cursor: 'pointer' }}
                  onClick={() => toggleNFTSelection(nft, isOffered)}
                  className={`${darkMode ? 'text-white' : ''} ${
                    (isOffered ? selectedOfferedNFTs : selectedRequestedNFTs)
                      .some(selected => selected.id === nft.id) ? 'border-primary' : ''
                  }`}
                >
                  {nft.metadata.image && (
                    <Card.Img
                      variant="top"
                      src={nft.metadata.image}
                      style={{ height: '180px', objectFit: 'cover' }}
                    />
                  )}
                  <Card.Body className="p-2">
                    <Card.Text className="text-center mb-0">
                      {nft.metadata.name || 'No name available'}
                    </Card.Text>
                  </Card.Body>
                  {(isOffered ? selectedOfferedNFTs : selectedRequestedNFTs)
                    .some(selected => selected.id === nft.id) && (
                    <Badge bg="primary" style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      Selected
                    </Badge>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
          <div className="d-flex justify-content-center mt-4">
            <Pagination>
              {[...Array(Math.ceil(filteredNFTs.length / nftsPerPage)).keys()].map((number) => (
                <Pagination.Item 
                  key={number + 1} 
                  active={number + 1 === currentPage}
                  onClick={() => paginate(number + 1)}
                >
                  {number + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          </div>
        </>
      )}
    </>
  );

  console.log('Parent component nftContract:', nftContract);

  const getDisplayAddress = (account) => {
    if (typeof account === 'string') {
      return account.length > 10 ? `${account.slice(0, 6)}...${account.slice(-4)}` : account;
    } else if (account && typeof account === 'object' && account.address) {
      const address = account.address;
      return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
    }
    return 'Unknown';
  };

  return (
    <div className={darkMode ? 'dark-mode' : ''}>
      <ToastContainer position="top-right" theme={darkMode ? "dark" : "light"} />
      <header className="app-header">
        <Container>
          <Row className="align-items-center">
            <Col>
              <div className="d-flex align-items-center">
                <img src="/nftrade-logo.png" alt="NFTrade Logo" className="me-3" style={{ height: '40px' }} />
                <h1 className="app-title">NFTrade</h1>
              </div>
            </Col>
            <Col className="text-end">
              {account ? (
                <div className="d-flex align-items-center justify-content-end">
                  <span className="account-badge me-3">
                    {getDisplayAddress(account)}
                  </span>
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={disconnectWallet}
                    className="disconnect-btn"
                  >
                    <FontAwesomeIcon icon={faPowerOff} />
                  </Button>
                </div>
              ) : (
                <Button variant="primary" onClick={connectWallet}>Connect Wallet</Button>
              )}
              <Form.Check 
                type="switch"
                id="dark-mode-switch"
                label={<FontAwesomeIcon icon={darkMode ? faMoon : faSun} />}
                checked={darkMode}
                onChange={toggleDarkMode}
                className="ms-3 d-inline-block"
              />
            </Col>
          </Row>
        </Container>
      </header>

      {isInitialized && (
        <Container className="main-content">
          {isConnecting ? (
            <Row className="justify-content-center">
              <Col md={6} className="text-center">
                <h2>Connecting to wallet...</h2>
                {/* You can add a loading spinner here */}
              </Col>
            </Row>
          ) : isWalletConnected ? (
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k)}
              className="mb-3"
            >
              <Tab eventKey="makeOffer" title="Make Offer">
                {renderMakeOfferTab()}
              </Tab>
              <Tab eventKey="receivedOffers" title="Received Offers">
                <ReceivedOffers 
                  contract={contract} 
                  account={account} 
                  darkMode={darkMode} 
                  nftContract={nftContract}
                  usdcContract={usdcContract}
                  provider={provider}
                />
              </Tab>
              <Tab eventKey="madeOffers" title="Made Offers">
                <MadeOffers 
                  contract={contract} 
                  account={account} 
                  darkMode={darkMode} 
                  nftContract={nftContract}
                />
              </Tab>
            </Tabs>
          ) : (
            <Row className="justify-content-center">
              <Col md={6} className="text-center">
                <h2>Welcome to NFTrade</h2>
                <p>Connect your wallet to start trading NFTs.</p>
                <Button variant="primary" size="lg" onClick={connectWallet}>Connect Wallet</Button>
              </Col>
            </Row>
          )}
        </Container>
      )}
    </div>
  );
}

export default App;
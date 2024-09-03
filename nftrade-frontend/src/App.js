import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Container, Row, Col, Button, Form, Card, Pagination, InputGroup } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import NFTradeABI from './NFTradeABI.json';
import './Pokeball.css';

const ERC721ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [offerID, setOfferID] = useState('');
  const [offeredNFTs, setOfferedNFTs] = useState('');
  const [offeredUSDC, setOfferedUSDC] = useState('');
  const [requestedNFTs, setRequestedNFTs] = useState('');
  const [requestedUSDC, setRequestedUSDC] = useState('');
  const [offeree, setOfferee] = useState('');
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [nftError, setNftError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [nftsPerPage] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);
          console.log("Provider set:", provider);

          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setAccount(address);
            console.log("Account set:", address);
            setupContract(signer);
          }
        } catch (error) {
          console.error("Error in init:", error);
        }
      } else {
        console.log("Ethereum object not found, do you have MetaMask installed?");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (account && provider) {
      console.log("Account and provider available, fetching NFTs");
      fetchOwnedNFTs();
    }
  }, [account, provider]);

  const setupContract = (signer) => {
    const contractAddress = "0xb9B4Abe50Fc0Bf69d79628a669D76F60702E6460";
    const nfTradeContract = new ethers.Contract(contractAddress, NFTradeABI, signer);
    setContract(nfTradeContract);
    console.log("Contract set up");
  };

  const connectWallet = async () => {
    if (provider) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        console.log("Wallet connected, account:", address);
        setupContract(signer);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        alert("Failed to connect wallet. Check console for details.");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setOwnedNFTs([]);
  };

  const fetchOwnedNFTs = async () => {
    console.log("fetchOwnedNFTs called");
    console.log("Account:", account);
    console.log("Provider:", provider);

    if (!account || !provider) {
      console.log("Account or provider not available");
      return;
    }

    setIsLoading(true);

    const nftContractAddress = "0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD";
    const nftContract = new ethers.Contract(nftContractAddress, ERC721ABI, provider);

    try {
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
      setNftError(null);
    } catch (error) {
      console.error("Error fetching owned NFTs:", error);
      setNftError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const makeOffer = async () => {
    if (!contract) return;
    try {
      const tx = await contract.makeOffer(
        offeredNFTs.split(',').map(id => parseInt(id.trim())),
        ethers.parseUnits(offeredUSDC, 6),
        requestedNFTs.split(',').map(id => parseInt(id.trim())),
        ethers.parseUnits(requestedUSDC, 6),
        offeree
      );
      await tx.wait();
      alert('Offer made successfully!');
    } catch (error) {
      console.error('Error making offer:', error);
      alert('Error making offer. Check console for details.');
    }
  };

  const acceptOffer = async () => {
    if (!contract) return;
    try {
      const tx = await contract.acceptOffer(offerID);
      await tx.wait();
      alert('Offer accepted successfully!');
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert('Error accepting offer. Check console for details.');
    }
  };

  const rejectOffer = async () => {
    if (!contract) return;
    try {
      const tx = await contract.rejectOffer(offerID);
      await tx.wait();
      alert('Offer rejected successfully!');
    } catch (error) {
      console.error('Error rejecting offer:', error);
      alert('Error rejecting offer. Check console for details.');
    }
  };

  const sealDeal = async () => {
    if (!contract) return;
    try {
      const tx = await contract.sealDeal(offerID);
      await tx.wait();
      alert('Deal sealed successfully!');
    } catch (error) {
      console.error('Error sealing deal:', error);
      alert('Error sealing deal. Check console for details.');
    }
  };

  // Filter NFTs based on search term
  const filteredNFTs = ownedNFTs.filter(nft => 
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

  return (
    <Container className="mt-5">
      <h1>NFTrade</h1>
      <Row className="mb-3">
        <Col>
          {account ? (
            <>
              <p>Connected Account: {account}</p>
              <Button variant="danger" onClick={disconnectWallet}>Disconnect Wallet</Button>
            </>
          ) : (
            <Button variant="primary" onClick={connectWallet}>Connect Wallet</Button>
          )}
        </Col>
      </Row>
      {account && (
        <Row className="mt-3">
          <Col>
            <h2>Your Courtyard NFTs</h2>
            <InputGroup className="mb-3">
              <Form.Control
                placeholder="Search NFTs by name"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Button variant="outline-secondary" onClick={() => setSearchTerm('')}>
                Clear
              </Button>
            </InputGroup>
            {nftError && <p className="text-danger">Error: {nftError}</p>}
            {isLoading ? (
              <div className="d-flex justify-content-center my-5">
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
                      <Card style={{ width: '100%', height: '100%' }}>
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
          </Col>
        </Row>
      )}
      {account && (
        <Row className="mt-3">
          <Col>
            <h2>Make Offer</h2>
            <Form>
              <Form.Group>
                <Form.Label>Offered NFTs (comma-separated IDs)</Form.Label>
                <Form.Control type="text" value={offeredNFTs} onChange={(e) => setOfferedNFTs(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Offered USDC</Form.Label>
                <Form.Control type="text" value={offeredUSDC} onChange={(e) => setOfferedUSDC(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Requested NFTs (comma-separated IDs)</Form.Label>
                <Form.Control type="text" value={requestedNFTs} onChange={(e) => setRequestedNFTs(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Requested USDC</Form.Label>
                <Form.Control type="text" value={requestedUSDC} onChange={(e) => setRequestedUSDC(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Offeree Address</Form.Label>
                <Form.Control type="text" value={offeree} onChange={(e) => setOfferee(e.target.value)} />
              </Form.Group>
              <Button variant="primary" onClick={makeOffer}>Make Offer</Button>
            </Form>
          </Col>
          <Col>
            <h2>Manage Offer</h2>
            <Form>
              <Form.Group>
                <Form.Label>Offer ID</Form.Label>
                <Form.Control type="text" value={offerID} onChange={(e) => setOfferID(e.target.value)} />
              </Form.Group>
              <Button variant="success" onClick={acceptOffer}>Accept Offer</Button>{' '}
              <Button variant="danger" onClick={rejectOffer}>Reject Offer</Button>{' '}
              <Button variant="warning" onClick={sealDeal}>Seal Deal</Button>
            </Form>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default App;
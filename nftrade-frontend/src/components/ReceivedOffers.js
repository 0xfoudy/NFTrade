import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import 'bootstrap-icons/font/bootstrap-icons.css';

function ReceivedOffers({ contract, account, darkMode, nftContract }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (contract && account && nftContract) {
      fetchOffers();
    } else {
      setLoading(true);
    }
  }, [contract, account, nftContract]);

  const fetchOffers = async () => {
    if (!contract || !account || !nftContract) {
      setError("Contracts or account not initialized");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const offerIds = await contract.viewReceivedOffers(account);
      console.log("Received offer IDs:", offerIds);

      const offerDetails = await Promise.all(offerIds.map(async (id) => {
        try {
          const offer = await contract.viewOffer(id);
          console.log(`Raw offer ${id} data:`, offer);
          
          const [offeredNFTsMetadata, requestedNFTsMetadata] = await Promise.all([
            fetchNFTsMetadata(offer[3]),
            fetchNFTsMetadata(offer[5])
          ]);

          return {
            id: offer[0],
            from: offer[1],
            to: offer[2],
            offeredNFTs: offeredNFTsMetadata,
            offeredUSDC: offer[4],
            requestedNFTs: requestedNFTsMetadata,
            requestedUSDC: offer[6],
            status: offer[7]
          };
        } catch (error) {
          console.error(`Error fetching offer ${id}:`, error);
          return null;
        }
      }));

      const validOffers = offerDetails.filter(offer => offer !== null);
      console.log("Valid fetched offer details:", validOffers);
      setOffers(validOffers);
    } catch (error) {
      console.error("Error fetching offers:", error);
      setError("Failed to fetch offers. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTsMetadata = async (nftIds) => {
    if (!nftContract) {
      console.warn('NFT contract is not initialized, using placeholder data');
      return nftIds.map(id => ({ id, name: `NFT ${id}`, image: '' }));
    }

    return Promise.all(nftIds.map(async (id) => {
      try {
        const tokenURI = await nftContract.tokenURI(id);
        console.log(`Token URI for NFT ${id}:`, tokenURI);
        const response = await fetch(tokenURI);
        const metadata = await response.json();
        console.log(`Metadata for NFT ${id}:`, metadata);
        return { id, name: metadata.name, image: metadata.image };
      } catch (error) {
        console.error(`Error fetching metadata for NFT ${id}:`, error);
        return { id, name: `NFT ${id}`, image: '' };
      }
    }));
  };

  const handleTransaction = async (action, offerId) => {
    let toastId;
    try {
      toastId = toast.loading('Sending transaction...', { autoClose: false });
      
      let tx;
      switch (action) {
        case 'accept':
          tx = await contract.acceptOffer(offerId);
          break;
        case 'reject':
          tx = await contract.rejectOffer(offerId);
          break;
        case 'finalize':
          tx = await contract.finalizeOffer(offerId);
          break;
        default:
          throw new Error('Invalid action');
      }

      const polygonscanUrl = `https://polygonscan.com/tx/${tx.hash}`;

      toast.update(toastId, { 
        render: "Transaction sent. Waiting for confirmation...", 
        type: "info", 
        isLoading: true 
      });

      await tx.wait();
      
      toast.update(toastId, { 
        render: (
          <div>
            Transaction successful!
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

      fetchOffers();
    } catch (error) {
      console.error(`Error ${action}ing offer:`, error);
      toast.update(toastId, { 
        render: (
          <div>
            Error {action}ing offer: {error.message}
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

  const handleAcceptOffer = (offerId) => handleTransaction('accept', offerId);
  const handleRejectOffer = (offerId) => handleTransaction('reject', offerId);
  const handleFinalizeOffer = (offerId) => handleTransaction('finalize', offerId);

  const renderNFTBadges = (nfts, isOffered) => {
    return (
      <div className="mt-2">
        {nfts.map((nft) => (
          <OverlayTrigger
            key={nft.id}
            placement="top"
            overlay={
              <Tooltip id={`tooltip-${nft.id}`}>
                <img src={nft.image} alt={nft.name} style={{ maxWidth: '200px', maxHeight: '200px' }} />
              </Tooltip>
            }
          >
            <Badge 
              bg={isOffered ? "primary" : "success"} 
              className="me-2 mb-2"
            >
              {nft.name}
            </Badge>
          </OverlayTrigger>
        ))}
      </div>
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Address copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  };

  const renderOfferStatus = (status) => {
    return (
      <Badge bg={status ? "success" : "warning"}>
        {status ? "Accepted" : "Pending"}
      </Badge>
    );
  };

  const renderOfferActions = (offer) => {
    console.log(`Offer ${offer.id} status:`, offer.status, typeof offer.status);

    if (offer.status === false) {
      return (
        <>
          <Button 
            variant="success" 
            onClick={() => handleAcceptOffer(offer.id)}
            className="me-2"
          >
            Accept
          </Button>
          <Button 
            variant="danger" 
            onClick={() => handleRejectOffer(offer.id)}
          >
            Reject
          </Button>
        </>
      );
    } else if (offer.status === true) {
      return (
        <Button 
          variant="primary" 
          onClick={() => handleFinalizeOffer(offer.id)}
        >
          Finalize
        </Button>
      );
    }
    return null;
  };

  if (loading) {
    return <div>Loading offers and NFT data...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <h2 className="section-title">Received Offers</h2>
      {offers.length === 0 ? (
        <div>No offers received yet.</div>
      ) : (
        offers.map((offer) => (
          <Card key={offer.id.toString()} className={`mb-3 ${darkMode ? 'text-white bg-dark' : ''}`}>
            <Card.Body>
              <Card.Title>Offer #{offer.id.toString()}</Card.Title>
              <div>
                <div>
                  <strong>From:</strong> {offer.from}
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => copyToClipboard(offer.from)}
                    className="p-0 ms-2"
                  >
                    <i className="bi bi-clipboard" style={{ fontSize: '1rem' }}></i>
                  </Button>
                </div>
                <div>
                  <strong>To:</strong> {offer.to}
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => copyToClipboard(offer.to)}
                    className="p-0 ms-2"
                  >
                    <i className="bi bi-clipboard" style={{ fontSize: '1rem' }}></i>
                  </Button>
                </div>
                <div>
                  <strong>Offered NFTs ({offer.offeredNFTs.length}):</strong>
                  {renderNFTBadges(offer.offeredNFTs, true)}
                </div>
                <div>
                  <strong>Offered USDC:</strong> {ethers.formatUnits(offer.offeredUSDC, 6)} USDC
                </div>
                <div>
                  <strong>Requested NFTs ({offer.requestedNFTs.length}):</strong>
                  {renderNFTBadges(offer.requestedNFTs, false)}
                </div>
                <div>
                  <strong>Requested USDC:</strong> {ethers.formatUnits(offer.requestedUSDC, 6)} USDC
                </div>
                <div>
                  <strong>Status:</strong> {renderOfferStatus(offer.status)}
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                {renderOfferActions(offer)}
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}

export default ReceivedOffers;

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Alert } from 'react-bootstrap';
import { ethers } from 'ethers';

function ReceivedOffers({ contract, account, darkMode }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOffers();
  }, [contract, account]);

  const fetchOffers = async () => {
    if (!contract || !account) return;
    setLoading(true);
    setError(null);
    try {
      const offerCount = await contract.getOfferCount(account);
      const fetchedOffers = [];
      for (let i = 0; i < offerCount; i++) {
        const offer = await contract.getOffer(account, i);
        fetchedOffers.push(offer);
      }
      setOffers(fetchedOffers);
    } catch (error) {
      console.error("Error fetching offers:", error);
      setError("Failed to fetch offers. Please try again later.");
    }
    setLoading(false);
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      const tx = await contract.acceptOffer(offerId);
      await tx.wait();
      fetchOffers(); // Refresh the offers after accepting
    } catch (error) {
      console.error("Error accepting offer:", error);
      setError("Failed to accept offer. Please try again.");
    }
  };

  if (loading) {
    return <div>Loading offers...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <h2 className="section-title">Received Offers</h2>
      {offers.length === 0 ? (
        <p>No offers received yet.</p>
      ) : (
        offers.map((offer, index) => (
          <Card key={index} className={`mb-3 ${darkMode ? 'text-white bg-dark' : ''}`}>
            <Card.Body>
              <Card.Title>Offer #{index + 1}</Card.Title>
              <Card.Text>
                <strong>From:</strong> {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}
                <br />
                <strong>Offered NFTs:</strong> {offer.offeredNFTs.length}
                <br />
                <strong>Offered USDC:</strong> {ethers.formatUnits(offer.offeredUSDC, 6)} USDC
                <br />
                <strong>Requested NFTs:</strong> {offer.requestedNFTs.length}
                <br />
                <strong>Requested USDC:</strong> {ethers.formatUnits(offer.requestedUSDC, 6)} USDC
                <br />
                <strong>Status:</strong> <Badge bg={offer.status === 0 ? "warning" : offer.status === 1 ? "success" : "danger"}>
                  {offer.status === 0 ? "Pending" : offer.status === 1 ? "Accepted" : "Cancelled"}
                </Badge>
              </Card.Text>
              {offer.status === 0 && (
                <Button variant="primary" onClick={() => handleAcceptOffer(index)}>
                  Accept Offer
                </Button>
              )}
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}

export default ReceivedOffers;

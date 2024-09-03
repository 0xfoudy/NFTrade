// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTrade is Ownable{
    // The following addresses are on Polygon.
    address constant public NFT_CONTRACT = 0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD;
    address constant public USDC_CONTRACT = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    uint256 private currentID = 0;
    uint8 public fees = 150;
    uint16 public FEES_DENUM = 10000;

    struct Offer {
        uint256 offerID;
        address offerer;
        address offeree;
        uint256[] offeredNFTs;
        uint256 offeredUSDC;
        uint256[] requestedNFTs;
        uint256 requestedUSDC;
        bool isAccepted;
    }

    // offeree => offerID[]
    mapping(address => uint256[]) userOffersMapping;
    // offerID => Offer
    mapping(uint256 => Offer) offersMapping;

    // Add these event declarations at the top of the contract
    event OfferCreated(uint256 indexed offerID, address indexed offerer, address indexed offeree);
    event OfferAccepted(uint256 indexed offerID, address indexed offeree);
    event DealSealed(uint256 indexed offerID, address indexed offerer, address indexed offeree);
    event OfferRejected(uint256 indexed offerID, address indexed offeree);

    constructor() Ownable(msg.sender) {}

    function makeOffer(uint256[] calldata _offeredNFTs, uint256 _offeredUSDC, uint256[] calldata _requestedNFTs, uint256 _requestedUSDC, address _offeree) public {
        require(isCurrentlyOwner(_offeredNFTs, msg.sender), "You do not own the offered NFTs");
        require(isCurrentlyOwner(_requestedNFTs, _offeree), "Offeree does not own the requested NFTs");
        Offer memory offer = Offer(++currentID, msg.sender, _offeree, _offeredNFTs, _offeredUSDC, _requestedNFTs, _requestedUSDC, false);
        userOffersMapping[_offeree].push(currentID);
        offersMapping[currentID] = offer;
        
        // Add this line at the end of the function
        emit OfferCreated(currentID, msg.sender, _offeree);
    }

    function isCurrentlyOwner(uint256[] calldata _NFTsID, address _owner) internal returns (bool) {
        for(uint256 i = 0; i < _NFTsID.length; ++i) {
            (bool success, bytes memory result) = NFT_CONTRACT.call(abi.encodeWithSignature("ownerOf(uint256)", _NFTsID[i]));
            require(success, "Failed to get owner...");
            address NFTOwner = abi.decode(result, (address));
            if(NFTOwner != _owner) return false;
        }
        return true;
    }

    function acceptOffer(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(msg.sender == offer.offeree, "Caller not offeree");
        offer.isAccepted = true;
        
        // Add this line at the end of the function
        emit OfferAccepted(_offerID, msg.sender);
    }

    function sealDeal(uint256 _offerID) public {
        Offer memory offer = offersMapping[_offerID];
        require(offer.isAccepted, "Offer not yet accepted");
        require(msg.sender == offer.offeree || msg.sender == offer.offerer, "Caller unrelated to offer");

        // transfer offerer's NFTs and USDC
        bool success = safeBatchTransferFrom(offer.offerer, offer.offeree, offer.offeredNFTs);

        uint256 feesFromOfferer = offer.offeredUSDC * fees / FEES_DENUM;
        uint256 USDCForOfferee = offer.offeredUSDC - feesFromOfferer;
        (success, ) = USDC_CONTRACT.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", offer.offerer, owner(), feesFromOfferer));
        require(success, "Failed to transfer fees from Offerer");
        (success, ) = USDC_CONTRACT.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", offer.offerer, offer.offeree, USDCForOfferee));
        require(success, "Failed to transfer USDC from Offerer");

        // transfer offeree's NFTs and USDC
        success = safeBatchTransferFrom(offer.offeree, offer.offerer, offer.requestedNFTs);
        require(success, "Failed to transfer NFTs from Offeree");

        uint256 feesFromOfferee = offer.requestedUSDC * fees / FEES_DENUM;
        uint256 USDCForOfferer = offer.requestedUSDC - feesFromOfferee;
        (success, ) = USDC_CONTRACT.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", offer.offeree, owner(), feesFromOfferee));
        require(success, "Failed to transfer fees from Offeree");
        (success, ) = USDC_CONTRACT.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", offer.offeree, offer.offerer, USDCForOfferer));
        require(success, "Failed to transfer USDC from Offeree");

        // Remove the offer from the user's offers mapping
        uint256[] storage userOffers = userOffersMapping[offer.offeree];
        for (uint256 i = 0; i < userOffers.length; i++) {
            if (userOffers[i] == _offerID) {
                userOffers[i] = userOffers[userOffers.length - 1];
                userOffers.pop();
                break;
            }
        }

        // Delete the offer from the offers mapping
        delete offersMapping[_offerID];

        // Emit the DealSealed event
        emit DealSealed(_offerID, offer.offerer, offer.offeree);
    }

    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _NFTsID) internal returns (bool success){
        for (uint256 i = 0; i < _NFTsID.length; ++i) {
            (success, ) = NFT_CONTRACT.call(abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", _from, _to, _NFTsID[i]));
        }
    }

    function viewReceivedOffers(address _offeree) public view returns (uint256[] memory) {
        return userOffersMapping[_offeree];
    }

    function viewOffer(uint256 _offerID) public view returns (Offer memory) {
        return offersMapping[_offerID];
    }

    function rejectOffer(uint256 _offerID) public {
        Offer storage offer = offersMapping[_offerID];
        require(msg.sender == offer.offeree, "Caller not offeree");
        require(!offer.isAccepted, "Offer already accepted");

        // Remove the offer from the user's offers mapping
        uint256[] storage userOffers = userOffersMapping[msg.sender];
        for (uint256 i = 0; i < userOffers.length; i++) {
            if (userOffers[i] == _offerID) {
                userOffers[i] = userOffers[userOffers.length - 1];
                userOffers.pop();
                break;
            }
        }

        // Delete the offer from the offers mapping
        delete offersMapping[_offerID];

        // Emit the OfferRejected event
        emit OfferRejected(_offerID, msg.sender);
    }

}

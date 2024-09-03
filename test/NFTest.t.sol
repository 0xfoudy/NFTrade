// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NFTrade} from "../src/NFTrade.sol";

contract NFTest is Test {
    NFTrade NFTradeContract;
    address user1 = 0xE56848D6C958403D08DbA42B20575134ba42eBB8;
    address user2 = 0xFb888CC74f143AAeA801771d4DC28f8b3533C88D;
    address USDC;
    address COURTYARD;

    function setUp() public {
        NFTradeContract = new NFTrade();

        USDC = NFTradeContract.USDC_CONTRACT();
        COURTYARD = NFTradeContract.NFT_CONTRACT();

        vm.createSelectFork("https://polygon-rpc.com", 61374493);

        deal(address(USDC), user1, 10_000 * 10**6);
        deal(address(USDC), user2, 10_000 * 10**6);
    }

    function test_createOfferNoUSDC() public {
        vm.startPrank(user1);

        uint256[] memory offeredNFTs = new uint256[](3);
        offeredNFTs[0] = 59102020161259651298634448887025090012036459599379426847030941352707217033986;
        offeredNFTs[1] = 40363463263142522187485932247600169045747411935325005972353878890754846845036;
        offeredNFTs[2] = 28152721527959864275877615996663718771212008144697651956298153000834878550702;

        uint256[] memory requestedNFTs = new uint256[](2);
        requestedNFTs[0] = 25198156570580340688212267630907501666166385519092029310552589328433038275091;
        requestedNFTs[1] = 85422471336966377924885937888813184793476324634016222114249390065103255359197;
        NFTradeContract.makeOffer(
            offeredNFTs,
            0, 
            requestedNFTs,
            0,
            user2);


        NFTrade.Offer memory offer = NFTradeContract.viewOffer(1);

    /*   for(uint256 i = 0; i < offer.offeredNFTs.length; ++i){
            console.log(offer.offeredNFTs[i]);
        }
    */

        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 59102020161259651298634448887025090012036459599379426847030941352707217033986));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 40363463263142522187485932247600169045747411935325005972353878890754846845036));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 28152721527959864275877615996663718771212008144697651956298153000834878550702));

        vm.expectRevert();
        NFTradeContract.acceptOffer(1);

        vm.stopPrank();

        vm.startPrank(user2);
        vm.expectRevert();
        NFTradeContract.sealDeal(1);

        NFTradeContract.acceptOffer(1);

        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 25198156570580340688212267630907501666166385519092029310552589328433038275091));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 85422471336966377924885937888813184793476324634016222114249390065103255359197));
        
        NFTradeContract.sealDeal(1);
        vm.stopPrank();

        (bool success, bytes memory result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 59102020161259651298634448887025090012036459599379426847030941352707217033986));
        assertEq(abi.decode(result, (address)), user2);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 40363463263142522187485932247600169045747411935325005972353878890754846845036));
        assertEq(abi.decode(result, (address)), user2);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 28152721527959864275877615996663718771212008144697651956298153000834878550702));
        assertEq(abi.decode(result, (address)), user2);

        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 25198156570580340688212267630907501666166385519092029310552589328433038275091));
        assertEq(abi.decode(result, (address)), user1);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 85422471336966377924885937888813184793476324634016222114249390065103255359197));
        assertEq(abi.decode(result, (address)), user1);
    }


    function test_createOfferUSDC() public {
        vm.startPrank(user1);

        uint256[] memory offeredNFTs = new uint256[](3);
        offeredNFTs[0] = 59102020161259651298634448887025090012036459599379426847030941352707217033986;
        offeredNFTs[1] = 40363463263142522187485932247600169045747411935325005972353878890754846845036;
        offeredNFTs[2] = 28152721527959864275877615996663718771212008144697651956298153000834878550702;

        uint256[] memory requestedNFTs = new uint256[](2);
        requestedNFTs[0] = 25198156570580340688212267630907501666166385519092029310552589328433038275091;
        requestedNFTs[1] = 85422471336966377924885937888813184793476324634016222114249390065103255359197;
        NFTradeContract.makeOffer(
            offeredNFTs,
            1200 * 10**6, 
            requestedNFTs,
            1100 * 10**6,
            user2);


        NFTrade.Offer memory offer = NFTradeContract.viewOffer(1);

    /*   for(uint256 i = 0; i < offer.offeredNFTs.length; ++i){
            console.log(offer.offeredNFTs[i]);
        }
    */

        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 59102020161259651298634448887025090012036459599379426847030941352707217033986));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 40363463263142522187485932247600169045747411935325005972353878890754846845036));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 28152721527959864275877615996663718771212008144697651956298153000834878550702));
        USDC.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 1200*10**6));

        vm.expectRevert();
        NFTradeContract.acceptOffer(1);

        vm.stopPrank();

        vm.startPrank(user2);
        vm.expectRevert();
        NFTradeContract.sealDeal(1);

        NFTradeContract.acceptOffer(1);

        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 25198156570580340688212267630907501666166385519092029310552589328433038275091));
        COURTYARD.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 85422471336966377924885937888813184793476324634016222114249390065103255359197));
        USDC.call(abi.encodeWithSignature("approve(address,uint256)", address(NFTradeContract), 1100*10**6));
        
        NFTradeContract.sealDeal(1);
        vm.stopPrank();

        (bool success, bytes memory result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 59102020161259651298634448887025090012036459599379426847030941352707217033986));
        assertEq(abi.decode(result, (address)), user2);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 40363463263142522187485932247600169045747411935325005972353878890754846845036));
        assertEq(abi.decode(result, (address)), user2);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 28152721527959864275877615996663718771212008144697651956298153000834878550702));
        assertEq(abi.decode(result, (address)), user2);

        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 25198156570580340688212267630907501666166385519092029310552589328433038275091));
        assertEq(abi.decode(result, (address)), user1);
        (,result) = COURTYARD.call(abi.encodeWithSignature("ownerOf(uint256)", 85422471336966377924885937888813184793476324634016222114249390065103255359197));
        assertEq(abi.decode(result, (address)), user1);

        (,bytes memory amount) = USDC.call(abi.encodeWithSignature("balanceOf(address)", user1));
        uint256 expectedUser1Balance = (10_000 * 10**6) - (1200 * 10**6) + (1100 * 10**6) - (1100 * 10**6 * 150 / 10_000);
      //  assertEq(abi.decode(amount, (uint256)), expectedUser1Balance);

        (,amount) = USDC.call(abi.encodeWithSignature("balanceOf(address)", address(this)));
        assertEq(abi.decode(amount, (uint256)), 345 * 10**5);
    }
}
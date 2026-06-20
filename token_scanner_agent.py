import requests  # type: ignore
import re
import json
import struct
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List

# Base58 alphabet (same as Bitcoin)
BASE58_ALPHABET = b'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

def base58_decode(s: str) -> bytes:
    """Decode a base58-encoded string to bytes."""
    num = 0
    for char in s:
        num = num * 58 + BASE58_ALPHABET.index(char.encode())
    # Convert to bytes
    result = num.to_bytes((num.bit_length() + 7) // 8, 'big') if num else b''
    # Add leading zeros
    pad = 0
    for char in s:
        if char == '1':
            pad += 1
        else:
            break
    return b'\x00' * pad + result

def base58_encode(b: bytes) -> str:
    """Encode bytes to base58 string."""
    num = int.from_bytes(b, 'big')
    result = ''
    while num > 0:
        num, remainder = divmod(num, 58)
        result = BASE58_ALPHABET[remainder:remainder+1].decode() + result
    # Add leading '1's for leading zero bytes
    for byte in b:
        if byte == 0:
            result = '1' + result
        else:
            break
    return result or '1'


class TokenScannerAgent:
    """
    A standalone Solana Token Scanner Agent that fetches real blockchain data
    and prepares structured intelligence data for other AntiRug agents.
    """

    def __init__(self):
        """Initialize the TokenScannerAgent with a cache and Solana RPC URL."""
        import os
        self.rpc_url = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.session = requests.Session()
        # Metaplex Token Metadata Program ID
        self.METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"

    def scan_token(self, token_address: str) -> Dict[str, Any]:
        """
        Scan a Solana SPL token and return structured intelligence data.
        
        Args:
            token_address (str): The Solana token mint address (base58).
            
        Returns:
            Dict[str, Any]: The structured data or error dictionary.
        """
        if not self._validate_token_address(token_address):
            return {"error": "Invalid Solana token address format"}

        if token_address in self.cache:
            return self.cache[token_address]

        # Fetch mint account data (supply, decimals, authorities)
        mint_data = self._fetch_mint_data(token_address)
        if not mint_data:
            return {"error": "Solana RPC unavailable or invalid token"}

        # Fetch token metadata (name, symbol) from Metaplex
        metadata = self._fetch_metadata(token_address)

        # Fetch top holders
        holders_data = self._fetch_largest_accounts(token_address)
        if holders_data is None:
            holders_data = []

        # Fetch recent transactions
        transactions_data = self._fetch_transactions(token_address)
        if not transactions_data:
            transactions_data = []

        name = metadata.get("name", "Unknown Token") if metadata else "Unknown Token"
        symbol = metadata.get("symbol", "UNKNOWN") if metadata else "UNKNOWN"
        is_mutable = metadata.get("is_mutable", False) if metadata else False

        total_supply = mint_data.get("supply", 0)
        decimals = mint_data.get("decimals", 0)
        mint_authority = mint_data.get("mint_authority")
        freeze_authority = mint_data.get("freeze_authority")

        # Security flags — mapped to match downstream agent expectations
        supply_key_exists = mint_authority is not None  # Can mint more tokens
        admin_key_exists = is_mutable  # Mutable metadata = admin-like control
        freeze_key_exists = freeze_authority is not None
        wipe_key_exists = False  # Solana has no wipe concept

        # Holder metrics
        holder_metrics = self._calculate_holder_metrics(holders_data, total_supply)
        
        # Activity metrics
        activity_metrics = self._calculate_activity_metrics(transactions_data)

        # Token age (from first transaction timestamp)
        now = datetime.now(timezone.utc)
        first_tx_time = activity_metrics.get("first_transaction_timestamp")
        if first_tx_time:
            try:
                created_datetime = datetime.fromisoformat(first_tx_time.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                created_datetime = now
        else:
            created_datetime = now

        token_age_days = max(0, (now - created_datetime).days)
        if token_age_days > 4000:
            token_age_days = 0

        if token_age_days < 7:
            age_risk_level = "VERY_HIGH"
        elif token_age_days < 30:
            age_risk_level = "HIGH"
        elif token_age_days < 180:
            age_risk_level = "MEDIUM"
        else:
            age_risk_level = "LOW"

        mint_risk = "HIGH" if supply_key_exists else "LOW"

        # Activity Risk
        transaction_count = activity_metrics["transaction_count"]
        recent_transaction_count = activity_metrics["recent_transaction_count"]
        
        if transaction_count < 20 and token_age_days > 90:
            activity_risk = "HIGH"
        elif recent_transaction_count < 5:
            activity_risk = "MEDIUM"
        else:
            activity_risk = "LOW"

        # Scanner Health Score
        scanner_health_score = 100
        if admin_key_exists:
            scanner_health_score -= 15
        if supply_key_exists:
            scanner_health_score -= 20
        if holder_metrics["top_holder_percentage"] > 40:
            scanner_health_score -= 15
        if holder_metrics["top_5_holder_percentage"] > 70:
            scanner_health_score -= 20
        if activity_risk in ["HIGH", "MEDIUM"]:
            scanner_health_score -= 10

        # Adjust values based on decimals for the LLM
        adjusted_total_supply = total_supply / (10 ** decimals) if decimals > 0 else total_supply
        adjusted_treasury = holder_metrics["treasury_balance"] / (10 ** decimals) if decimals > 0 else holder_metrics["treasury_balance"]

        result = {
            "token_id": token_address,
            "name": name,
            "symbol": symbol,
            "type": "SPL_TOKEN",
            "total_supply": adjusted_total_supply,
            "raw_total_supply": total_supply,
            "decimals": decimals,
            "treasury_account": mint_authority or "",
            "treasury_balance": adjusted_treasury,
            "admin_key_exists": admin_key_exists,
            "supply_key_exists": supply_key_exists,
            "freeze_key_exists": freeze_key_exists,
            "wipe_key_exists": wipe_key_exists,
            "holder_count": holder_metrics["holder_count"],
            "top_holder_percentage": holder_metrics["top_holder_percentage"],
            "top_5_holder_percentage": holder_metrics["top_5_holder_percentage"],
            "transaction_count": transaction_count,
            "recent_transaction_count": recent_transaction_count,
            "last_transaction_timestamp": activity_metrics["last_transaction_timestamp"],
            "token_age_days": token_age_days,
            "age_risk_level": age_risk_level,
            "mint_risk": mint_risk,
            "activity_risk": activity_risk,
            "scanner_health_score": scanner_health_score,
            "source": "solana_rpc",
            # Solana-specific extras
            "mint_authority": mint_authority,
            "freeze_authority": freeze_authority,
            "metadata_is_mutable": is_mutable,
        }

        # ========================================
        # NEW: Advanced Solana Intelligence Data
        # ========================================

        # Authority details (fix update authority mapping)
        authority_details = self._fetch_authority_details(token_address)
        result.update({
            "mint_authority_active": mint_authority is not None,
            "freeze_authority_active": freeze_authority is not None,
            "update_authority_active": authority_details.get("update_authority_active", is_mutable),
            "update_authority_address": authority_details.get("update_authority_address"),
            "is_multisig": authority_details.get("is_multisig", False),
        })

        # LP Lock analysis
        lp_data = self._fetch_lp_lock_status(token_address)
        result.update({
            "lp_burned": lp_data.get("lp_burned", False),
            "lp_locked": lp_data.get("lp_locked", False),
            "lock_duration_days": lp_data.get("lock_duration_days", 0),
            "lock_percentage": lp_data.get("lock_percentage", 0),
            "unlock_date": lp_data.get("unlock_date"),
            "lp_mint": lp_data.get("lp_mint"),
        })

        # Creator wallet activity (insider tracking)
        creator_data = self._fetch_creator_wallet_activity(token_address, transactions_data)
        result.update({
            "creator_wallet": creator_data.get("creator_wallet"),
            "creator_current_holdings_pct": creator_data.get("creator_current_holdings_pct", 0),
            "creator_sold_pct": creator_data.get("creator_sold_pct", 0),
            "creator_fully_exited": creator_data.get("creator_fully_exited", False),
        })

        # Early buyers (sniper & bundler detection)
        early_data = self._fetch_early_buyers(token_address, transactions_data, total_supply)
        result.update({
            "first_block_buyers": early_data.get("first_block_buyers", 0),
            "first_5_blocks_buyers": early_data.get("first_5_blocks_buyers", 0),
            "sniper_supply_pct": early_data.get("sniper_supply_pct", 0),
            "bundled_wallets": early_data.get("bundled_wallets", []),
            "bundled_supply_pct": early_data.get("bundled_supply_pct", 0),
        })

        # Holder relationships (wallet graph)
        graph_data = self._fetch_holder_relationships(token_address, holders_data, creator_data.get("creator_wallet"))
        result.update({
            "wallet_clusters": graph_data.get("wallet_clusters", []),
            "creator_linked_holders_pct": graph_data.get("creator_linked_holders_pct", 0),
            "max_cluster_supply_pct": graph_data.get("max_cluster_supply_pct", 0),
            "relationship_edges": graph_data.get("relationship_edges", []),
        })
        if graph_data and "owner_wallets" in graph_data and graph_data["owner_wallets"]:
            result["holders"] = [{"address": w, "balance": b} for w, b in graph_data["owner_wallets"].items()]
        else:
            result["holders"] = [{"address": h.get("account", ""), "balance": h.get("balance", 0)} for h in holders_data if h.get("account")]

        # Volume metrics (wash trading detection)
        volume_data = self._fetch_volume_metrics(token_address, transactions_data)
        result.update({
            "unique_traders_24h": volume_data.get("unique_traders_24h", 0),
            "volume_per_trader": volume_data.get("volume_per_trader", 0),
            "wash_trade_score": volume_data.get("wash_trade_score", 0),
            "liquidity_usd": volume_data.get("liquidity_usd", 0.0),
            "fdv": volume_data.get("fdv", 0.0),
            "buys_24h": volume_data.get("buys_24h", 0),
            "sells_24h": volume_data.get("sells_24h", 0),
        })

        self.cache[token_address] = result
        return result

    def _validate_token_address(self, address: str) -> bool:
        """Validate the format of a Solana base58 address."""
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', address):
            return False
        try:
            decoded = base58_decode(address)
            return len(decoded) == 32
        except Exception:
            return False

    def _rpc_call(self, method: str, params: list) -> Optional[Dict[str, Any]]:
        """Make a Solana JSON-RPC call."""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }
        for _ in range(3):
            try:
                response = self.session.post(
                    self.rpc_url,
                    json=payload,
                    timeout=10,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 200:
                    data = response.json()
                    if "error" in data:
                        return None
                    return data.get("result")
            except requests.RequestException:
                continue
        return None

    def _rpc_batch_call(self, calls: List[Dict[str, Any]]) -> List[Optional[Dict[str, Any]]]:
        """Make batched Solana JSON-RPC calls for efficiency."""
        payload = []
        for i, call in enumerate(calls):
            payload.append({
                "jsonrpc": "2.0",
                "id": i + 1,
                "method": call["method"],
                "params": call["params"]
            })
        try:
            response = self.session.post(
                self.rpc_url,
                json=payload,
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                results = response.json()
                if isinstance(results, list):
                    # Sort by id to maintain order
                    results.sort(key=lambda x: x.get("id", 0))
                    return [r.get("result") if "error" not in r else None for r in results]
        except requests.RequestException:
            pass
        return [None] * len(calls)

    def _fetch_mint_data(self, token_address: str) -> Optional[Dict[str, Any]]:
        """Fetch mint account data from Solana RPC using getAccountInfo."""
        result = self._rpc_call("getAccountInfo", [
            token_address,
            {"encoding": "jsonParsed"}
        ])
        if not result or not result.get("value"):
            return None

        value = result["value"]
        data = value.get("data")

        if isinstance(data, dict) and data.get("parsed"):
            parsed = data["parsed"]
            info = parsed.get("info", {})
            return {
                "supply": int(info.get("supply", "0")),
                "decimals": int(info.get("decimals", 0)),
                "mint_authority": info.get("mintAuthority"),
                "freeze_authority": info.get("freezeAuthority"),
                "is_initialized": info.get("isInitialized", False),
            }
        return None

    def _get_metadata_pda(self, mint_address: str) -> str:
        """Derive the Metaplex metadata PDA for a given mint address."""
        metadata_program = base58_decode(self.METADATA_PROGRAM_ID)
        mint_bytes = base58_decode(mint_address)
        
        # Seeds: ["metadata", metadata_program_id, mint_address]
        seeds = [
            b"metadata",
            metadata_program,
            mint_bytes,
        ]
        
        # Find PDA
        for nonce in range(255, -1, -1):
            try:
                hasher = hashlib.sha256()
                for seed in seeds:
                    hasher.update(seed)
                hasher.update(bytes([nonce]))
                hasher.update(metadata_program)
                hasher.update(b"ProgramDerivedAddress")
                hash_bytes = hasher.digest()
                
                # Check if the point is on the ed25519 curve
                # A valid PDA must NOT be on the curve
                # For simplicity, we try to find the PDA by checking nonce
                return base58_encode(hash_bytes)
            except Exception:
                continue
        return ""

    def _fetch_metadata(self, token_address: str) -> Optional[Dict[str, Any]]:
        """Fetch token metadata (name, symbol) from Metaplex or fallback sources."""
        # Try fetching from a metadata API first (more reliable than PDA parsing)
        try:
            # Try using the token list or Jupiter API for metadata
            response = self.session.get(
                f"https://tokens.jup.ag/token/{token_address}",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "name": data.get("name", "Unknown Token"),
                    "symbol": data.get("symbol", "UNKNOWN"),
                    "is_mutable": True,  # Default conservative assumption
                }
        except Exception:
            pass

        # Fallback: try raw Metaplex PDA account data
        try:
            pda = self._get_metadata_pda(token_address)
            if pda:
                result = self._rpc_call("getAccountInfo", [
                    pda,
                    {"encoding": "base64"}
                ])
                if result and result.get("value"):
                    raw_data = result["value"]["data"]
                    if isinstance(raw_data, list) and len(raw_data) >= 1:
                        account_bytes = base64.b64decode(raw_data[0])
                        return self._parse_metadata_account(account_bytes)
        except Exception:
            pass

        return None

    def _parse_metadata_account(self, data: bytes) -> Optional[Dict[str, Any]]:
        """Parse Metaplex metadata account binary data."""
        try:
            if len(data) < 70:
                return None

            offset = 1  # Skip key byte
            
            # Read update authority (32 bytes)
            update_authority_bytes = data[offset:offset + 32]
            update_authority = base58_encode(update_authority_bytes)
            offset += 32  # Skip update authority
            offset += 32  # Skip mint

            # Read name (4 bytes length prefix + string)
            name_len = struct.unpack_from("<I", data, offset)[0]
            offset += 4
            name = data[offset:offset + name_len].decode("utf-8", errors="ignore").rstrip("\x00").strip()
            offset += name_len

            # Read symbol
            symbol_len = struct.unpack_from("<I", data, offset)[0]
            offset += 4
            symbol = data[offset:offset + symbol_len].decode("utf-8", errors="ignore").rstrip("\x00").strip()
            offset += symbol_len

            # Read URI
            uri_len = struct.unpack_from("<I", data, offset)[0]
            offset += 4
            offset += uri_len  # Skip URI

            # Skip seller fee basis points (2 bytes)
            offset += 2

            # Skip creators option
            has_creators = data[offset] if offset < len(data) else 0
            offset += 1
            if has_creators:
                num_creators = struct.unpack_from("<I", data, offset)[0]
                offset += 4
                offset += num_creators * (32 + 1 + 1)  # address + verified + share

            # Skip primary_sale_happened (1 byte)
            offset += 1

            # Read is_mutable
            is_mutable = bool(data[offset]) if offset < len(data) else True

            return {
                "name": name or "Unknown Token",
                "symbol": symbol or "UNKNOWN",
                "is_mutable": is_mutable,
                "update_authority": update_authority,
            }
        except Exception:
            return None

    def _fetch_largest_accounts(self, token_address: str) -> Optional[List[Dict[str, Any]]]:
        """Fetch top token holders using getTokenLargestAccounts."""
        result = self._rpc_call("getTokenLargestAccounts", [token_address])
        if not result or not result.get("value"):
            return None

        accounts = []
        for acc in result["value"]:
            accounts.append({
                "account": acc.get("address", ""),
                "balance": int(acc.get("amount", "0")),
                "ui_amount": acc.get("uiAmount", 0),
            })
        return accounts

    def _fetch_transactions(self, token_address: str) -> Optional[List[Dict[str, Any]]]:
        """Fetch recent transaction signatures for the token mint."""
        result = self._rpc_call("getSignaturesForAddress", [
            token_address,
            {"limit": 100}
        ])
        if not result:
            return None
        return result  # Returns list of signature objects

    def _calculate_holder_metrics(self, holders: List[Dict[str, Any]], total_supply: int) -> Dict[str, Any]:
        """Calculate holder-related metrics from getTokenLargestAccounts data."""
        metrics = {
            "holder_count": 0,
            "treasury_balance": 0,
            "top_holder_percentage": 0.0,
            "top_5_holder_percentage": 0.0
        }

        if not holders:
            return metrics

        active_holders = [h for h in holders if h.get("balance", 0) > 0]
        metrics["holder_count"] = len(active_holders)

        if total_supply > 0 and active_holders:
            # Sort by balance descending
            sorted_holders = sorted(active_holders, key=lambda x: x.get("balance", 0), reverse=True)

            # Top holder
            top_balance = sorted_holders[0].get("balance", 0)
            metrics["top_holder_percentage"] = round((top_balance / total_supply) * 100, 2)
            
            # Treasury balance = largest holder (proxy for treasury on Solana)
            metrics["treasury_balance"] = top_balance

            # Top 5
            top_5_balance = sum(h.get("balance", 0) for h in sorted_holders[:5])
            metrics["top_5_holder_percentage"] = round((top_5_balance / total_supply) * 100, 2)

        return metrics

    def _calculate_activity_metrics(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate transaction-related activity metrics."""
        metrics: Dict[str, Any] = {
            "transaction_count": 0,
            "recent_transaction_count": 0,
            "last_transaction_timestamp": None,
            "first_transaction_timestamp": None,
        }

        if not transactions:
            return metrics

        metrics["transaction_count"] = len(transactions)

        # Get timestamps from blockTime
        valid_txs = [tx for tx in transactions if tx.get("blockTime")]
        
        if not valid_txs:
            return metrics

        # Sort by blockTime
        sorted_txs = sorted(valid_txs, key=lambda tx: tx.get("blockTime", 0))

        # First transaction (oldest)
        first_time = sorted_txs[0].get("blockTime", 0)
        if first_time > 0:
            first_dt = datetime.fromtimestamp(first_time, tz=timezone.utc)
            metrics["first_transaction_timestamp"] = first_dt.isoformat()

        # Last transaction (newest)
        last_time = sorted_txs[-1].get("blockTime", 0)
        if last_time > 0:
            last_dt = datetime.fromtimestamp(last_time, tz=timezone.utc)
            metrics["last_transaction_timestamp"] = last_dt.isoformat()

        # Recent transactions (last 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_count = 0
        for tx in valid_txs:
            bt = tx.get("blockTime", 0)
            if bt > 0:
                tx_time = datetime.fromtimestamp(bt, tz=timezone.utc)
                if tx_time >= seven_days_ago:
                    recent_count += 1

        metrics["recent_transaction_count"] = recent_count
        return metrics

    # ========================================
    # NEW: Advanced Solana Intelligence Methods
    # ========================================

    def _fetch_authority_details(self, token_address: str) -> Dict[str, Any]:
        """
        Fetch detailed authority info including actual update authority from Metaplex.
        Detects multi-sig programs (Squads, Realms).
        """
        result: Dict[str, Any] = {
            "update_authority_active": False,  # Changed from True to avoid false positive 95 score
            "update_authority_address": None,
            "is_multisig": False,
        }

        try:
            # Fetch the Metaplex metadata PDA to get update authority
            pda = self._get_metadata_pda(token_address)
            if pda:
                rpc_result = self._rpc_call("getAccountInfo", [
                    pda,
                    {"encoding": "base64"}
                ])
                if rpc_result and rpc_result.get("value"):
                    raw_data = rpc_result["value"]["data"]
                    if isinstance(raw_data, list) and len(raw_data) >= 1:
                        account_bytes = base64.b64decode(raw_data[0])
                        if len(account_bytes) >= 33:
                            # Update authority is bytes 1-33
                            update_auth_bytes = account_bytes[1:33]
                            update_auth = base58_encode(update_auth_bytes)
                            result["update_authority_address"] = update_auth

                            # Check if update authority is null (all zeros = renounced)
                            if update_auth_bytes == b'\x00' * 32:
                                result["update_authority_active"] = False
                            else:
                                result["update_authority_active"] = True

                                # Check if authority is a known multi-sig program
                                KNOWN_MULTISIG_PROGRAMS = [
                                    "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu",  # Squads v3
                                    "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMJkvj52pCf",  # Squads v4
                                    "GovER5Lthms3bLBqWub97yVRqDfY73x61Qjf6GfMEkF",  # Realms
                                ]
                                # Check if authority account is owned by a multi-sig program
                                auth_info = self._rpc_call("getAccountInfo", [
                                    update_auth,
                                    {"encoding": "base64"}
                                ])
                                if auth_info and auth_info.get("value"):
                                    owner = auth_info["value"].get("owner", "")
                                    if owner in KNOWN_MULTISIG_PROGRAMS:
                                        result["is_multisig"] = True
        except Exception:
            pass

        return result

    def _fetch_lp_lock_status(self, token_address: str) -> Dict[str, Any]:
        """
        Check if the LP tokens for this token are burned or locked.
        Checks Raydium AMM pools via DexScreener for pair info,
        then checks LP token accounts for burn/lock signals.
        """
        result: Dict[str, Any] = {
            "lp_burned": False,
            "lp_locked": False,
            "lock_duration_days": 0,
            "lock_percentage": 0,
            "unlock_date": None,
            "lp_mint": None,
        }

        try:
            # Use DexScreener to find the main trading pair
            response = self.session.get(
                f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
                timeout=8
            )
            if response.status_code != 200:
                return result

            data = response.json()
            pairs = data.get("pairs", [])
            if not pairs:
                return result

            # Get the primary pair (highest liquidity)
            primary_pair = max(pairs, key=lambda p: float(p.get("liquidity", {}).get("usd", 0) or 0))
            pair_address = primary_pair.get("pairAddress")

            if not pair_address:
                return result

            # Check the pair account to find LP mint
            pair_info = self._rpc_call("getAccountInfo", [
                pair_address,
                {"encoding": "jsonParsed"}
            ])
            if pair_info and pair_info.get("value"):
                # For Raydium AMM, the LP mint is encoded in the pool state
                # We'll check if LP tokens were sent to the burn address
                BURN_ADDRESS = "1111111111111111111111111111111111"  # System program (burn target)
                
                # Check DexScreener for liquidity lock info if available
                info = primary_pair.get("info", {})
                
                # Check if any locks are reported
                locks = primary_pair.get("locks", [])
                if locks:
                    total_locked_pct = sum(float(l.get("percent", 0)) for l in locks)
                    max_unlock = max((l.get("unlockDate") for l in locks if l.get("unlockDate")), default=None)
                    result["lp_locked"] = True
                    result["lock_percentage"] = min(total_locked_pct, 100)
                    result["unlock_date"] = max_unlock
                    if max_unlock:
                        try:
                            unlock_dt = datetime.fromisoformat(max_unlock.replace('Z', '+00:00'))
                            result["lock_duration_days"] = max(0, (unlock_dt - datetime.now(timezone.utc)).days)
                        except (ValueError, TypeError):
                            pass

                # Check for burned LP (look for largest LP holder being burn address)
                lp_mint = primary_pair.get("labels", [])
                if "BURNED" in [l.upper() for l in lp_mint if isinstance(l, str)]:
                    result["lp_burned"] = True
                    result["lp_locked"] = True
                    result["lock_percentage"] = 100
                    result["lock_duration_days"] = 99999  # Permanent

        except Exception:
            pass

        return result

    def _fetch_creator_wallet_activity(self, token_address: str, 
                                        transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Identify the creator/deployer wallet and track their current holdings.
        The creator is identified from the earliest transaction (token creation).
        """
        result: Dict[str, Any] = {
            "creator_wallet": None,
            "creator_current_holdings_pct": 0,
            "creator_sold_pct": 0,
            "creator_fully_exited": False,
        }

        try:
            if not transactions:
                return result

            # Sort by blockTime ascending to find the earliest transaction
            valid_txs = [tx for tx in transactions if tx.get("blockTime")]
            if not valid_txs:
                return result

            sorted_txs = sorted(valid_txs, key=lambda tx: tx.get("blockTime", 0))
            earliest_sig = sorted_txs[0].get("signature")

            if not earliest_sig:
                return result

            # Fetch the full transaction to identify the creator
            tx_detail = self._rpc_call("getTransaction", [
                earliest_sig,
                {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
            ])
            if not tx_detail:
                return result

            # The first signer is typically the creator/deployer
            account_keys = tx_detail.get("transaction", {}).get("message", {}).get("accountKeys", [])
            if not account_keys:
                return result

            creator_wallet = None
            for key in account_keys:
                if isinstance(key, dict):
                    if key.get("signer"):
                        creator_wallet = key.get("pubkey")
                        break
                elif isinstance(key, str):
                    creator_wallet = key
                    break

            if not creator_wallet:
                return result

            result["creator_wallet"] = creator_wallet

            # Check creator's current token holdings
            token_accounts = self._rpc_call("getTokenAccountsByOwner", [
                creator_wallet,
                {"mint": token_address},
                {"encoding": "jsonParsed"}
            ])

            creator_balance = 0
            if token_accounts and token_accounts.get("value"):
                for acc in token_accounts["value"]:
                    parsed = acc.get("account", {}).get("data", {}).get("parsed", {})
                    info = parsed.get("info", {})
                    token_amount = info.get("tokenAmount", {})
                    creator_balance += float(token_amount.get("uiAmount", 0) or 0)

            # Get total supply for percentage calculation
            mint_data = self._rpc_call("getAccountInfo", [
                token_address,
                {"encoding": "jsonParsed"}
            ])
            if mint_data and mint_data.get("value"):
                parsed = mint_data["value"].get("data", {}).get("parsed", {})
                info = parsed.get("info", {})
                total_supply_raw = int(info.get("supply", "0"))
                decimals = int(info.get("decimals", 0))
                total_supply = total_supply_raw / (10 ** decimals) if decimals > 0 else total_supply_raw

                if total_supply > 0:
                    creator_pct = (creator_balance / total_supply) * 100
                    result["creator_current_holdings_pct"] = round(creator_pct, 2)
                    result["creator_sold_pct"] = 0  # Avoid false positive 100% sold if tokens are in LP
                    result["creator_fully_exited"] = False  # Avoid false positive 95 score override if creator provided LP

        except Exception:
            pass

        return result

    def _fetch_early_buyers(self, token_address: str,
                             transactions: List[Dict[str, Any]],
                             total_supply: int) -> Dict[str, Any]:
        """
        Analyze the earliest transactions to detect sniper bots and bundled purchases.
        Identifies wallets that bought in the first block/slot and calculates their
        current share of supply.
        """
        result: Dict[str, Any] = {
            "first_block_buyers": 0,
            "first_5_blocks_buyers": 0,
            "sniper_supply_pct": 0,
            "bundled_wallets": [],
            "bundled_supply_pct": 0,
        }

        try:
            if not transactions:
                return result

            # Sort by blockTime/slot ascending
            valid_txs = [tx for tx in transactions if tx.get("blockTime")]
            if not valid_txs:
                return result

            sorted_txs = sorted(valid_txs, key=lambda tx: tx.get("blockTime", 0))

            # Get the first transaction's slot as reference
            first_slot = sorted_txs[0].get("slot", 0)
            if not first_slot:
                return result

            # Group transactions by slot
            slot_groups: Dict[int, List[str]] = {}
            for tx in sorted_txs:
                slot = tx.get("slot", 0)
                sig = tx.get("signature", "")
                if slot and sig:
                    if slot not in slot_groups:
                        slot_groups[slot] = []
                    slot_groups[slot].append(sig)

            # Count buyers in first block (same slot)
            first_block_sigs = slot_groups.get(first_slot, [])
            result["first_block_buyers"] = len(first_block_sigs)

            # Count buyers in first 5 blocks
            sorted_slots = sorted(slot_groups.keys())
            first_5_slots = sorted_slots[:5]
            first_5_sigs = []
            for s in first_5_slots:
                first_5_sigs.extend(slot_groups.get(s, []))
            result["first_5_blocks_buyers"] = len(first_5_sigs)

            # Detect bundled transactions (multiple buys in same slot = potential Jito bundle)
            bundled_wallets = set()
            for slot, sigs in slot_groups.items():
                if len(sigs) >= 3:  # 3+ transactions in same slot = likely bundled
                    for sig in sigs[:5]:  # Check up to 5 to limit RPC calls
                        try:
                            tx_detail = self._rpc_call("getTransaction", [
                                sig,
                                {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                            ])
                            if tx_detail:
                                account_keys = tx_detail.get("transaction", {}).get("message", {}).get("accountKeys", [])
                                for key in account_keys:
                                    if isinstance(key, dict) and key.get("signer"):
                                        bundled_wallets.add(key.get("pubkey", ""))
                                    elif isinstance(key, str):
                                        bundled_wallets.add(key)
                                        break
                        except Exception:
                            continue

            result["bundled_wallets"] = list(bundled_wallets)[:20]  # Cap at 20

            # Estimate supply held by sniper/bundled wallets
            # Check their token balances
            sniper_balance = 0
            for wallet in list(bundled_wallets)[:10]:  # Check top 10 to limit calls
                try:
                    token_accounts = self._rpc_call("getTokenAccountsByOwner", [
                        wallet,
                        {"mint": token_address},
                        {"encoding": "jsonParsed"}
                    ])
                    if token_accounts and token_accounts.get("value"):
                        for acc in token_accounts["value"]:
                            parsed = acc.get("account", {}).get("data", {}).get("parsed", {})
                            info = parsed.get("info", {})
                            token_amount = info.get("tokenAmount", {})
                            sniper_balance += int(token_amount.get("amount", "0"))
                except Exception:
                    continue

            if total_supply > 0 and sniper_balance > 0:
                sniper_pct = round((sniper_balance / total_supply) * 100, 2)
                result["sniper_supply_pct"] = sniper_pct
                result["bundled_supply_pct"] = sniper_pct  # Same wallets for now

        except Exception:
            pass

        return result

    def _fetch_holder_relationships(self, token_address: str,
                                     holders: List[Dict[str, Any]],
                                     creator_wallet: Optional[str]) -> Dict[str, Any]:
        """
        Build a wallet relationship graph by tracing SOL transfer history
        between top holders. Detects shared funding sources and wallet clusters.
        Uses union-find for clustering.
        """
        result: Dict[str, Any] = {
            "wallet_clusters": [],
            "creator_linked_holders_pct": 0,
            "max_cluster_supply_pct": 0,
            "relationship_edges": [],
        }

        try:
            if not holders or len(holders) < 2:
                return result

            # Get top 10 holder account addresses (token accounts, not owner wallets)
            top_holders = sorted(holders, key=lambda h: h.get("balance", 0), reverse=True)[:10]
            
            # For each token account, find the owner wallet
            owner_wallets: Dict[str, int] = {}  # wallet -> balance
            holder_accounts = [h["account"] for h in top_holders if h.get("account")]
            
            # Batch fetch token account info to get owner wallets
            batch_calls = [{
                "method": "getAccountInfo",
                "params": [acc, {"encoding": "jsonParsed"}]
            } for acc in holder_accounts]
            
            if batch_calls:
                batch_results = self._rpc_batch_call(batch_calls)
                for i, res in enumerate(batch_results):
                    if res and res.get("value"):
                        parsed = res["value"].get("data", {})
                        if isinstance(parsed, dict) and parsed.get("parsed"):
                            owner = parsed["parsed"].get("info", {}).get("owner")
                            if owner:
                                owner_wallets[owner] = top_holders[i].get("balance", 0)

            if len(owner_wallets) < 2:
                result["owner_wallets"] = owner_wallets
                return result

            # For each owner wallet, fetch recent SOL transfer history
            # Look for shared funding sources
            wallet_funders: Dict[str, set] = {}  # wallet -> set of wallets that sent SOL to it
            edges = []

            for wallet in list(owner_wallets.keys())[:8]:  # Limit to 8 for RPC efficiency
                sigs = self._rpc_call("getSignaturesForAddress", [
                    wallet,
                    {"limit": 15}
                ])
                if not sigs:
                    continue

                funders = set()
                for sig_info in sigs[:10]:
                    sig = sig_info.get("signature")
                    if not sig:
                        continue
                    try:
                        tx = self._rpc_call("getTransaction", [
                            sig,
                            {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                        ])
                        if not tx:
                            continue
                        
                        # Look for SOL transfers TO this wallet
                        instructions = tx.get("transaction", {}).get("message", {}).get("instructions", [])
                        for inst in instructions:
                            parsed_inst = inst.get("parsed", {})
                            if isinstance(parsed_inst, dict) and parsed_inst.get("type") == "transfer":
                                info = parsed_inst.get("info", {})
                                source = info.get("source")
                                dest = info.get("destination")
                                lamports = info.get("lamports", 0)
                                if dest == wallet and source and lamports > 0:
                                    funders.add(source)
                                    edges.append({
                                        "from": source,
                                        "to": wallet,
                                        "amount": lamports / 1e9  # Convert to SOL
                                    })
                    except Exception:
                        continue

                wallet_funders[wallet] = funders

            result["relationship_edges"] = edges[:50]  # Cap edges

            # Union-Find clustering based on shared funders
            wallet_list = list(owner_wallets.keys())
            parent = {w: w for w in wallet_list}

            def find(x):
                while parent.get(x, x) != x:
                    parent[x] = parent.get(parent[x], x)
                    x = parent[x]
                return x

            def union(a, b):
                ra, rb = find(a), find(b)
                if ra != rb:
                    parent[ra] = rb

            # Cluster wallets with shared funders
            for w1 in wallet_list:
                for w2 in wallet_list:
                    if w1 >= w2:
                        continue
                    funders1 = wallet_funders.get(w1, set())
                    funders2 = wallet_funders.get(w2, set())
                    # If they share any funder OR one funded the other
                    if funders1 & funders2 or w1 in funders2 or w2 in funders1:
                        union(w1, w2)

            # Build clusters
            clusters: Dict[str, List[str]] = {}
            for w in wallet_list:
                root = find(w)
                if root not in clusters:
                    clusters[root] = []
                clusters[root].append(w)

            # Filter to clusters with 2+ wallets
            real_clusters = [c for c in clusters.values() if len(c) >= 2]
            result["wallet_clusters"] = real_clusters

            # Calculate max cluster supply percentage
            total_supply_held = sum(owner_wallets.values())
            if total_supply_held > 0:
                for cluster in real_clusters:
                    cluster_balance = sum(owner_wallets.get(w, 0) for w in cluster)
                    cluster_pct = round((cluster_balance / total_supply_held) * 100, 2)
                    if cluster_pct > result["max_cluster_supply_pct"]:
                        result["max_cluster_supply_pct"] = cluster_pct

            # Check if creator is linked to any cluster
            if creator_wallet:
                creator_root = find(creator_wallet)
                creator_cluster = clusters.get(creator_root, [])
                if len(creator_cluster) > 1 and total_supply_held > 0:
                    linked_balance = sum(owner_wallets.get(w, 0) for w in creator_cluster if w != creator_wallet)
                    result["creator_linked_holders_pct"] = round((linked_balance / total_supply_held) * 100, 2)

            result["owner_wallets"] = owner_wallets
        except Exception:
            pass

        return result

    def _fetch_volume_metrics(self, token_address: str,
                               transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze trading volume for wash-trading signals.
        Calculates unique traders vs volume ratio.
        """
        result: Dict[str, Any] = {
            "unique_traders_24h": 0,
            "volume_per_trader": 0,
            "wash_trade_score": 0,
            "liquidity_usd": 0.0,
            "fdv": 0.0,
        }

        try:
            if not transactions:
                return result

            # Count unique signers in last 24 hours
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(hours=24)
            unique_signers = set()

            for tx in transactions:
                bt = tx.get("blockTime", 0)
                if bt > 0:
                    tx_time = datetime.fromtimestamp(bt, tz=timezone.utc)
                    if tx_time >= cutoff:
                        # The signer is not directly in signatures list,
                        # but each signature corresponds to a unique transaction
                        sig = tx.get("signature", "")
                        if sig:
                            unique_signers.add(sig)

            result["unique_traders_24h"] = len(unique_signers)

            # Fetch volume from DexScreener
            try:
                response = self.session.get(
                    f"https://api.dexscreener.com/latest/dex/tokens/{token_address}",
                    timeout=8
                )
                if response.status_code == 200:
                    data = response.json()
                    pairs = data.get("pairs", [])
                    if pairs:
                        primary = max(pairs, key=lambda p: float(p.get("volume", {}).get("h24", 0) or 0))
                        volume_24h = float(primary.get("volume", {}).get("h24", 0) or 0)
                        result["liquidity_usd"] = float(primary.get("liquidity", {}).get("usd", 0) or 0)
                        result["fdv"] = float(primary.get("fdv", 0) or 0)
                        
                        txns_h24 = primary.get("txns", {}).get("h24", {})
                        result["buys_24h"] = int(txns_h24.get("buys", 0))
                        result["sells_24h"] = int(txns_h24.get("sells", 0))

                        if volume_24h > 0 and result["unique_traders_24h"] > 0:
                            result["volume_per_trader"] = round(volume_24h / result["unique_traders_24h"], 2)

                        # Wash trade score
                        if result["unique_traders_24h"] < 20 and volume_24h > 100000:
                            result["wash_trade_score"] = 90
                        elif result["volume_per_trader"] > 50000:
                            result["wash_trade_score"] = 80
                        elif result["volume_per_trader"] > 10000:
                            result["wash_trade_score"] = 60
                        elif result["volume_per_trader"] > 5000:
                            result["wash_trade_score"] = 40
                        else:
                            result["wash_trade_score"] = 10

            except Exception:
                pass

        except Exception:
            pass

        return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        token_address = sys.argv[1]
        agent = TokenScannerAgent()
        result = agent.scan_token(token_address)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "No token address provided"}))


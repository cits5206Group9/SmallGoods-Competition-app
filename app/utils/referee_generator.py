import random
import string
from typing import List, Dict


def generate_random_username(prefix: str = "ref", length: int = 6) -> str:
    """Generate a random username with prefix"""
    random_part = "".join(
        random.choices(string.ascii_lowercase + string.digits, k=length)
    )
    return f"{prefix}_{random_part}"


def generate_random_password(length: int = 8) -> str:
    """Generate a random password"""
    characters = string.ascii_letters + string.digits + "!@#$%"
    return "".join(random.choices(characters, k=length))


def generate_referee_positions(count: int) -> List[str]:
    """Generate referee position names"""
    positions = [
        "Head Referee",
        "Side Referee 1",
        "Side Referee 2",
        "Center Referee",
        "Left Referee",
        "Right Referee",
        "Chief Referee",
        "Assistant Referee 1",
        "Assistant Referee 2",
        "Technical Referee",
    ]

    if count <= len(positions):
        return positions[:count]
    else:
        # If we need more referees than predefined positions, generate numbered ones
        result = positions[:]
        for i in range(len(positions) + 1, count + 1):
            result.append(f"Referee {i}")
        return result


def generate_sample_referee_data(
    count: int, competition_name: str = "Competition"
) -> List[Dict]:
    """Generate sample referee data for a competition"""
    positions = generate_referee_positions(count)
    sample_emails = [
        "referee1@competition.com",
        "referee2@competition.com",
        "referee3@competition.com",
        "head.referee@competition.com",
        "side.referee1@competition.com",
        "side.referee2@competition.com",
        "center.referee@competition.com",
        "chief.referee@competition.com",
        "assistant1@competition.com",
        "technical.referee@competition.com",
    ]

    sample_phones = [
        "+1234567890",
        "+1234567891",
        "+1234567892",
        "+1234567893",
        "+1234567894",
        "+1234567895",
        "+1234567896",
        "+1234567897",
        "+1234567898",
        "+1234567899",
    ]

    # Generate sample names
    first_names = [
        "John",
        "Sarah",
        "Mike",
        "Emma",
        "David",
        "Lisa",
        "James",
        "Maria",
        "Robert",
        "Jennifer",
    ]
    last_names = [
        "Smith",
        "Johnson",
        "Williams",
        "Brown",
        "Jones",
        "Garcia",
        "Miller",
        "Davis",
        "Rodriguez",
        "Martinez",
    ]

    referees = []
    for i in range(count):
        first_name = first_names[i % len(first_names)]
        last_name = last_names[i % len(last_names)]
        referee_data = {
            "name": f"{first_name} {last_name}",  # Add the missing name field
            "username": generate_random_username("ref", 6),
            "password": generate_random_password(8),
            "position": positions[i],
            "email": sample_emails[i]
            if i < len(sample_emails)
            else f"referee{i + 1}@competition.com",
            "phone": sample_phones[i] if i < len(sample_phones) else f"+123456789{i}",
            "is_active": True,
            "competition_name": competition_name,
        }
        referees.append(referee_data)

    return referees

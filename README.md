VGC Shelf

**VGC Shelf (Video Game Collection Shelf)** is a self-hosted, open-source video game collection manager designed by collectors, for collectors.

Track physical and digital games, systems, peripherals, and collectibles from a central location that you control. No subscriptions, no vendor lock-in, and no dependence on a third-party service to access your collection.

---

## Why VGC Shelf?

I created VGC Shelf because I couldn't find a collection tracker that fit my needs.

Many collection apps either:

* Require recurring subscriptions
* Focus on marketplaces instead of collections
* Lack self-hosting options
* Don't provide centralized access across devices
* Make it difficult to maintain ownership of your data

I wanted a system that allowed me to:

* Track my entire collection
* Access it from any device
* Host it myself
* Control my own data
* Share collections with family and friends

VGC Shelf was built to solve those problems.

---

## About This Project

This is my first major software project.

I'll be honest: AI played a significant role in helping me build the backend of this app. If you're a developer, designer, tester, or collector who wants to contribute, I would love your help!

My goal is to grow VGC Shelf into a community-driven project that continues improving over time.

---

## Features

### Collection Management

* Create multiple collections
* Shared collections with multiple users
* Collection images
* Collection descriptions
* Collection ownership and permissions

### Game Tracking

* Physical and digital games
* Systems and consoles
* Peripherals and accessories
* Toys-to-life collections
* Barcode support
* Metadata lookup

### Lending & Asset Tracking

* Asset tags with QR codes
* Custom asset numbering
* Check-in / check-out tracking
* Due dates
* Lending reports

### Wishlist & Sell List

* Separate wishlist management
* Sell list tracking
* Collection-to-sell-list workflow

### Reporting

* Collection value tracking
* Platform breakdowns
* Collection analytics
* Checked-out item reports

### Administration

* User management
* Registration controls
* Branding customization
* Custom app icon and favicon
* Database backup and restore

### Self Hosting

* Docker support
* Docker Compose support
* Unraid compatible
* PostgreSQL backend
* Optional Redis caching

---

## Technology Stack

| Component      | Technology       |
| -------------- | ---------------- |
| Frontend       | Next.js 14       |
| UI             | Tailwind CSS     |
| Backend        | Express.js       |
| Language       | TypeScript       |
| Database       | PostgreSQL       |
| ORM            | Prisma           |
| Authentication | JWT              |
| Caching        | Redis (Optional) |
| Deployment     | Docker Compose   |

---

# Quick Start

## Requirements

* Docker
* Docker Compose

## Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/vgc-shelf.git
cd vgc-shelf
```

## Start the Application

```bash
docker compose up -d --build
```

Once started, access:

| Service      | URL                          |
| ------------ | ---------------------------- |
| Frontend     | http://localhost:3000        |
| Backend API  | http://localhost:4000        |
| Health Check | http://localhost:4000/health |

The first account created automatically becomes an administrator.

---

## Updating

Pull the latest changes:

```bash
git pull
docker compose down
docker compose up -d --build
```

---

## Optional Redis

Redis is optional.

If Redis is unavailable, the application automatically falls back to PostgreSQL.

Enable Redis:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.redis.yml \
  up -d --build
```

---

## Data Persistence

Your collection data is stored in Docker volumes.

Before major upgrades, it is recommended to:

* Create a database backup from the Admin page
* Export important collections
* Back up Docker volumes

---

## Unraid Installation

VGC Shelf is designed to run on standard Docker hosts and Unraid.

Typical Unraid setup:

* AppData storage for persistent data
* PostgreSQL container
* VGC Shelf frontend
* VGC Shelf backend

Map persistent volumes according to the provided compose files.

---

## Roadmap

Planned improvements include:

* Improved mobile experience
* Enhanced barcode scanning
* Additional collection analytics
* More metadata providers
* Expanded reporting
* Community-requested features

---

## Contributing

Contributions are welcome.

Whether you are:

* Fixing bugs
* Improving the UI
* Refactoring code
* Writing documentation
* Testing releases
* Suggesting features

Your help is appreciated.

Please open an issue or submit a pull request.

---

## License

This project is licensed under the MIT License.

---

## Disclaimer

VGC Shelf is a community project provided as-is.

Always maintain backups of your data before upgrading or modifying your installation.

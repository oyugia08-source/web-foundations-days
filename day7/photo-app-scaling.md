# SnapShare Scaling Plan

## Assumptions and estimates

- There are 10 million registered users, and 10% are active each day: `10,000,000 x 0.10 = 1,000,000 daily active users (DAU)`.
- Each DAU uploads one 2 MB original photo and views 50 feed pages per day; each original also has one 50 KB thumbnail.
- Traffic is averaged across 24 hours and 365 days per year; peak feed traffic is five times the average. MB, KB, TB, and PB use decimal units.
- Photos are retained for the year, and the storage estimate excludes replicas, backups, metadata, and any extra image variants.

| Measure | Calculation | Estimate |
| --- | --- | ---: |
| Daily uploads | `1,000,000 DAU x 1 photo` | `1,000,000 photos/day` |
| Average uploads per second | `1,000,000 / 86,400` | `11.6 uploads/second` (about 12) |
| Average feed views per second | `1,000,000 DAU x 50 / 86,400` | `579 views/second` |
| Peak feed views per second | `579 x 5` | `2,894 views/second` (about 2,900) |
| Original photo storage per year | `1,000,000 x 2 MB x 365` | `730,000,000 MB` = `730 TB` |
| Thumbnail storage per year | `1,000,000 x 50 KB x 365` | `18,250,000,000 KB` = `18.25 TB` |
| Total photo storage per year | `730 TB + 18.25 TB` | `748.25 TB` (about `0.75 PB`) |

## Workload and storage choice

SnapShare is **read-heavy**: the assumptions give 50 feed-page views per active user per day for every one photo upload, and each page can return multiple photos. The design therefore caches feed metadata and serves image bytes from a CDN, while keeping writes durable and moving thumbnail work off the upload request path.

Photo files should not be stored as large binary values in the relational database: that would inflate database storage and backups and make image delivery and scaling more expensive. Store originals and thumbnails in object storage; keep their object keys, ownership, timestamps, and processing state in the database.

## Architecture

```text
+---------+  API  +--------------+  +-------------+
| Clients |----->| Load balancer|->| App servers |
+----+----+      +--------------+  +--+--+--+----+
     |                                |  |  |
     |                                |  |  +---- feed reads/writes --> +-------+
     |                                |  |                              | Cache |
     |                                |  |                              +-------+
     |                                |  +---- feed reads ------------> +------------------+
     |                                |                                  | DB read replica  |
     |                                |                                  +--------^---------+
     |                                |                                           | replication
     |                                +---- metadata writes --> +----------------+--+
     |                                                          | Database primary |
     |                                                          +------------------+
     |
     +-- signed PUT ------------------------------------------------> Object storage
     |
     +-- photo GET --> +-----+  cache miss -------------------------> Object storage
                       | CDN |
                       +-----+

App servers -- thumbnail job --> +-------+ --> +----------------+
                                 | Queue |     | Thumbnail      |
                                 +-------+     | worker         |
                                               +---+---------+--+
                                                   |         |
                                     read original |         | write thumbnail
                                                   +----+----+
                                                        v
                                                  Object storage
```

## Component responsibilities

- **CDN:** Caches and serves photos close to viewers, reducing image latency and load on origin services and object storage.
- **Load balancer:** Distributes incoming API traffic across healthy app-server instances.
- **App servers:** Authenticate users, handle feed and upload APIs, coordinate metadata writes, and enqueue image-processing jobs.
- **Cache:** Holds frequently requested feed metadata to reduce repeated database reads.
- **Database primary:** Stores durable user, follow, photo metadata, and upload-processing state, and accepts writes.
- **Database read replica:** Serves read-only feed queries to scale reads while replication keeps it updated from the primary.
- **Object storage:** Stores original photo and thumbnail files durably without putting large binaries in database rows.
- **Queue:** Buffers thumbnail jobs so upload requests do not wait for image processing and jobs can be retried.
- **Thumbnail worker:** Consumes queued jobs, creates smaller image variants, stores them in object storage, and updates photo status in the database.

## Photo upload flow

1. The client asks an app server to start an upload; the app authenticates the user, checks limits, creates a pending photo metadata record, and returns a short-lived signed upload URL.
2. The client uploads the original photo directly to object storage using that URL, avoiding routing the large file through an app server.
3. The client tells the app server the upload completed; the app verifies the stored object and adds a thumbnail job to the queue.
4. A thumbnail worker takes the job, reads the original from object storage, generates the 50 KB thumbnail, and writes it back to object storage.
5. The worker marks the photo ready in the database; feed queries can then return its metadata and CDN image URL to followers.
6. Viewers request the image through the CDN; on a cache miss, the CDN retrieves it from object storage and caches it for later requests.

## Trade-offs

- **Asynchronous thumbnails add processing delay:** Uploads finish without waiting for resizing, improving upload responsiveness, but a photo may not appear in feeds until the worker finishes; pending and failed states need to be handled.
- **Read replicas and caches can be stale:** They reduce load and improve feed response times, but replication lag or cached entries may briefly hide a new upload or follow change; invalidation and refresh rules add complexity.
- **CDN caching improves speed but complicates freshness:** Long cache lifetimes lower origin traffic and delivery costs, while edits or deletions may take time to reach viewers unless cache invalidation is used.
- **Object storage scales photo bytes separately but adds coordination:** The database and object store do not share one transaction, so the upload flow needs pending states, retries, and cleanup for incomplete uploads.
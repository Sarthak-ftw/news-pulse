# News Pulse ⚡ - Real-time News Clustering & Editorial Dashboard

News Pulse is a highly polished, recruiter-ready production dashboard that fetches, normalizes, and groups real-time news articles from various RSS feeds into unified "story clusters" using custom machine learning clustering algorithms. It features a modern, responsive, and beautifully designed user interface designed to showcase complex data aggregates cleanly.

---

## 1. Project Overview

The objective of News Pulse is to solve the problem of information fragmentation. When major events unfold, multiple publishers report the same story from different angles. Instead of showing duplicate headlines, News Pulse clusters articles about the same story together, displaying them as a single cohesive card. The user can inspect the coverage depth (match strength, publisher dots, TF-IDF keyword tooltips) and open a Linear/Notion-style side drawer to review coverage from all reporting outlets.

---

## 2. Ingestion & Clustering Pipeline

The system processes real-time feeds sequentially in a highly decoupled, multi-tier architecture:

```mermaid
graph TD
    A[RSS / API Feeds] -->|XML Feed Fetching| B[Python Scraper/Fetcher]
    B -->|Clean Text & Stop Words| C[TF-IDF Vectorization]
    C -->|Pairwise Math Comparison| D[Cosine Similarity Matrix]
    D -->|Union-Find Clustering| E[Story Clusters & Keywords]
    E -->|Bulk Upsert & DB Save| F[(PostgreSQL Database)]
    F -->|JSON Query Endpoint| G[Node.js Express Backend]
    G -->|Client SWR fetching| H[Next.js Frontend Dashboard]
```

1. **RSS/API Sources**: The fetcher pulls articles from 10 high-volume sources (BBC, NPR, Reuters, Guardian, Al Jazeera).
2. **Python Fetcher**: Fetches, parses, normalizes, and hashes article content to prevent duplicates.
3. **TF-IDF Vectorization**: Fits a Term Frequency-Inverse Document Frequency vectorizer to analyze word importance across articles.
4. **Cosine Similarity**: Calculates pairwise similarity matrices representing the geometric proximity of articles.
5. **Story Clusters**: Employs Disjoint Set Union (Union-Find) algorithms to group articles above a specific threshold and extract top TF-IDF keyword features.
6. **Node.js Backend**: Exposes clean JSON API endpoints.
7. **Frontend Dashboard**: A Next.js visual interface with custom CSS styling, dynamic date filtering, search, animated statistics, and details drawers.

---

## 3. Tech Stack

- **Data Ingestion**: Python (Feedparser, Psycopg2, scikit-learn, NumPy)
- **Algorithms**: TF-IDF Vectorization, Pairwise Cosine Similarity, Disjoint Set Union (Union-Find)
- **Database**: PostgreSQL (pg pool, lateral joins, array fields)
- **Backend API**: Node.js, Express
- **Frontend App**: Next.js (App Router, SWR client caching, Lucide icons)
- **Styling**: Vanilla CSS custom design system (with layout transitions and responsive queries)

---

## 4. Clustering Algorithm Detail

1. **Vectorization (TF-IDF)**:
   - The combined text (title + summary) of all new articles is cleaned of URLs, publisher branding, and standard stop words.
   - Text is converted into numerical feature vectors where each word is weighted using TF-IDF:
     $$\text{TF-IDF}(t, d, D) = \text{TF}(t, d) \times \text{IDF}(t, D)$$
     This penalizes common words (like "said", "today") and rewards specific keywords (like "earthquake", "senate").

2. **Similarity Matrix (Cosine Similarity)**:
   - Measures the cosine of the angle between two multi-dimensional TF-IDF vectors:
     $$\text{similarity}(A, B) = \cos(\theta) = \frac{A \cdot B}{\|A\| \|B\|}$$
   - Returns a value between `0.0` (orthogonal/no word overlap) and `1.0` (identical).

3. **Connected Components Grouping**:
   - Compares all articles. If the cosine similarity between Article $i$ and Article $j$ exceeds the threshold (e.g. `0.08`), they are connected.
   - A Disjoint Set Union (DSU) algorithm aggregates these connections into partitioned sets representing individual story clusters.

4. **Labeling and Keyword Extraction**:
   - For each cluster, we compute the average TF-IDF feature weight across its constituent articles.
   - The top 3 features are concatenated as the uppercase cluster title, and the top 5 features are stored in the database as keywords.

---

## 5. Current Limitations

- **Semantic Similarity Gap**: TF-IDF relies on exact term overlaps. It misses semantic matches (e.g. grouping "automobile crash" with "car accident" if they don't share exact words).
- **Synonym Incompatibility**: Cannot associate synonyms unless they are close enough in document frequency or context.
- **Threshold Tuning**: A static cosine similarity threshold (e.g., `0.08`) can lead to cluster fragmentation if set too high, or near-unrelated news merging if set too low.
- **Duplicate handling**: Articles with minor changes are clustered, but strict deduplication on title/hash is required before vectorization.

---

## 6. Future Improvements

- **Sentence-Transformers**: Integrate BERT/SBERT embeddings to calculate semantic vectors instead of pure word overlap statistics.
- **FAISS (Facebook AI Similarity Search)**: Use FAISS or a vector database (e.g., pgvector) to scale vector search to millions of articles in sub-milliseconds.
- **Incremental Clustering**: Update clusters dynamically on a per-article ingestion hook instead of rebuilding the matrix from scratch.
- **Semantic Search**: Enable natural language semantic querying across all clusters.
- **Real-Time Streaming**: Stream updates directly using WebSockets or Server-Sent Events (SSE).

---

## 7. Deployment Instructions

This monorepo is ready to deploy across a serverless database (Supabase), a Node.js web hosting platform (Render), a frontend hosting platform (Vercel), and automated background runners (GitHub Actions).

### 🗄️ Database Setup (Supabase)
1. **Create Project**: Sign up on [Supabase](https://supabase.com/) and create a new free-tier PostgreSQL project.
2. **Retrieve Connection String**:
   - Go to **Project Settings** > **Database**.
   - Copy the **URI** connection string under Connection Strings (PostgreSQL format).
   - Ensure the password you entered during project setup is replaced in the URI string placeholder.
3. **Database Schema**: The schema is automatically initialized or updated with required migrations when the Python scraper is executed for the first time. No manual table creation is required!

---

### 🚀 Backend Service (Render)
We use a **Render Blueprint** configuration (`render.yaml`) to automate the backend deployment.

1. **Deploying from GitHub**:
   - Push this repository to your GitHub account.
   - On the [Render Dashboard](https://dashboard.render.com/), click **New** > **Blueprint**.
   - Select your repository. Render will automatically detect the `render.yaml` configuration.
2. **Environment Variables**:
   - During the Blueprint setup, you will be prompted to enter the `DATABASE_URL`. Paste the Supabase connection string.
   - The environment variables `PYTHON_SCRIPT_PATH` (defaults to `../scraper/main.py`), `PYTHON_BIN` (defaults to `python3`), and `PORT` (defaults to `10000`) are automatically pre-configured.
3. **Deploy**: Render will build the Node.js Express backend and install python dependencies in the environment.

---

### 💻 Frontend Deployment (Vercel)
Vercel is the recommended host for the Next.js frontend.

1. **Import Project**:
   - Go to [Vercel](https://vercel.com/) and click **Add New** > **Project**.
   - Choose your GitHub repository.
2. **Configure Monorepo Settings**:
   - Set the **Root Directory** to `frontend`.
   - Vercel will automatically configure the build command (`npm run build`) and output directory for Next.js.
3. **Configure Environment Variables**:
   - Add a new environment variable:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://your-backend-service-url.onrender.com` (replace with your Render backend Web Service URL).
4. **Deploy**: Click **Deploy**. Vercel will build the frontend and serve it.

---

### ⏱ Automated Python Scraper Pipeline (GitHub Actions)
Rather than relying on Render web services to compile and run resource-heavy machine learning libraries (`scikit-learn`, `numpy`), the scraper pipeline is configured to run serverlessly on GitHub Actions.

1. **Enable GitHub Actions**:
   - The workflow configuration is located in [scrape.yml](file:///.github/workflows/scrape.yml).
   - Once pushed to GitHub, navigate to the **Actions** tab of your repository.
2. **Add Environment Secrets**:
   - Go to **Settings** > **Secrets and variables** > **Actions** in your GitHub repository.
   - Click **New repository secret**.
   - **Name**: `DATABASE_URL`
   - **Value**: Paste the Supabase connection string.
3. **How it Runs**:
   - The workflow runs automatically **every hour** via the cron trigger `0 * * * *`.
   - You can also manually trigger it at any time by going to the **Actions** tab, selecting **Scrape News**, and clicking **Run workflow**.
